package com.sep490.bms.integration;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.entity.account.*;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.*;
import com.sep490.bms.security.JwtTokenProvider;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

/** Hai request thật chạy ở hai transaction độc lập trên SQL Server.
 * Fixture riêng phải commit để cả hai luồng nhìn thấy; @AfterEach xóa theo đúng ID fixture.
 */
@SpringBootTest(properties={"bms.job.enabled=false", "app.booking-change.jobs-enabled=false", "bms.scheduler.match-sweep.enabled=false"})
@EnabledIfEnvironmentVariable(named="BMS_MAINTENANCE_INTEGRATION", matches="true")
class MaintenanceConcurrencyApiTests {
    @Autowired WebApplicationContext context;
    @Autowired AccountRepository accounts;
    @Autowired LocationRepository locations;
    @Autowired CourtRepository courts;
    @Autowired MaintenanceRepository maintenance;
    @Autowired JwtTokenProvider jwt;
    @Autowired ObjectMapper json;
    @Autowired PlatformTransactionManager transactions;
    MockMvc mvc;
    Fixture fixture;
    record Fixture(Account owner, Account staff, Location location, Court court) {}

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        fixture = new TransactionTemplate(transactions).execute(tx -> {
            Account owner = account(Role.OWNER, null);
            Location location = locations.saveAndFlush(Location.builder().ownerId(owner.getId())
                    .name("Kiểm thử đồng thời bảo trì").address("Fixture kiểm thử đồng thời bảo trì")
                    .latitude(BigDecimal.valueOf(21)).longitude(BigDecimal.valueOf(105)).contactPhone(owner.getPhone()).build());
            Account staff = account(Role.STAFF, location.getId());
            Court court = courts.saveAndFlush(Court.builder().locationId(location.getId()).name("Sân fixture đồng thời").build());
            return new Fixture(owner, staff, location, court);
        });
    }
    @AfterEach void cleanup() {
        if (fixture == null) return;
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            maintenance.deleteAllInBatch(maintenance.findAllByCourtIdInOrderByCreatedAtDescIdDesc(List.of(fixture.court().getId())));
            courts.deleteById(fixture.court().getId());
            accounts.deleteById(fixture.staff().getId());
            accounts.flush(); courts.flush();
            locations.deleteById(fixture.location().getId()); locations.flush();
            accounts.deleteById(fixture.owner().getId()); accounts.flush();
        });
    }
    private Account account(Role role, Long locationId) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0,10);
        return accounts.saveAndFlush(Account.builder().username("c"+suffix).email(suffix+"@example.com")
                .phone("0"+String.format("%09d",Math.floorMod(UUID.randomUUID().getMostSignificantBits(),1_000_000_000L)))
                .passwordHash("unused").fullName("Kiểm thử đồng thời").role(role).locationId(locationId).status(AccountStatus.ACTIVE).build());
    }
    private String token(Account user) { return "Bearer "+jwt.generateToken(user); }
    private ResultActions create(Account user) throws Exception {
        var start = LocalDate.now().plusDays(2).atTime(9,0);
        String body = json.writeValueAsString(Map.of("courtId",fixture.court().getId(),"startAt",start.toString(),
                "endAt",start.plusHours(1).toString(),"reason","Yêu cầu fixture đồng thời"));
        return mvc.perform(post("/api/staff/maintenance-requests").header("Authorization",token(user))
                .header("X-Location-Id",fixture.location().getId()).contentType("application/json").content(body));
    }
    private long pending() throws Exception {
        var response = create(fixture.staff()).andExpect(status().isCreated()).andReturn();
        return json.readTree(response.getResponse().getContentAsString()).at("/data/id").asLong();
    }
    private int decide(long id, String action) throws Exception {
        boolean cancel = action.equals("cancel");
        return mvc.perform(post("/api/"+(cancel ? "staff" : "owner")+"/maintenance-requests/"+id+"/"+action)
                .header("Authorization",token(cancel ? fixture.staff() : fixture.owner()))
                .header("X-Location-Id",fixture.location().getId()).contentType("application/json")
                .content(action.equals("reject") ? "{\"reason\":\"Không cần bảo trì\"}" : "{}"))
                .andReturn().getResponse().getStatus();
    }
    private List<Integer> race(Callable<Integer> left, Callable<Integer> right) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CyclicBarrier barrier = new CyclicBarrier(2);
        try {
            Future<Integer> first = pool.submit(() -> { barrier.await(10,TimeUnit.SECONDS); return left.call(); });
            Future<Integer> second = pool.submit(() -> { barrier.await(10,TimeUnit.SECONDS); return right.call(); });
            return List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS));
        } finally { pool.shutdownNow(); pool.awaitTermination(5,TimeUnit.SECONDS); }
    }
    @Test void simultaneousOverlappingSubmissionsCreateOnlyOneRequest() throws Exception {
        assertThat(race(() -> create(fixture.owner()).andReturn().getResponse().getStatus(),
                () -> create(fixture.staff()).andReturn().getResponse().getStatus())).containsExactlyInAnyOrder(201,409);
        assertThat(maintenance.findAllByCourtIdInOrderByCreatedAtDescIdDesc(List.of(fixture.court().getId()))).hasSize(1);
    }
    @Test void approvingAndWithdrawingCannotBothSucceed() throws Exception {
        long id = pending();
        assertThat(race(() -> decide(id,"approve"), () -> decide(id,"cancel"))).containsExactlyInAnyOrder(200,409);
        Maintenance item = maintenance.findById(id).orElseThrow();
        if (item.getStatus() == ApprovalStatus.APPROVED) {
            assertThat(item.getApprovedBy()).isEqualTo(fixture.owner().getId());
            assertThat(item.getCancelledBy()).isNull();
        } else {
            assertThat(item.getStatus()).isEqualTo(ApprovalStatus.CANCELLED);
            assertThat(item.getCancelledBy()).isEqualTo(fixture.staff().getId());
            assertThat(item.getApprovedBy()).isNull();
        }
    }
    @Test void approvingAndRejectingCannotBothSucceed() throws Exception {
        long id = pending();
        assertThat(race(() -> decide(id,"approve"), () -> decide(id,"reject"))).containsExactlyInAnyOrder(200,409);
        assertThat(maintenance.findById(id).orElseThrow().getStatus()).isIn(ApprovalStatus.APPROVED,ApprovalStatus.REJECTED);
    }
    @Test void doubleApprovalHasOneWinner() throws Exception {
        long id = pending();
        assertThat(race(() -> decide(id,"approve"), () -> decide(id,"approve"))).containsExactlyInAnyOrder(200,409);
        assertThat(maintenance.findById(id).orElseThrow().getStatus()).isEqualTo(ApprovalStatus.APPROVED);
    }
}
