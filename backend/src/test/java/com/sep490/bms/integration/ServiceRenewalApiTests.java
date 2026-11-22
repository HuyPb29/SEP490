package com.sep490.bms.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.entity.account.*;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.*;
import com.sep490.bms.security.JwtTokenProvider;
import com.sep490.bms.service.booking.PackageService;

@SpringBootTest(properties={"bms.job.enabled=false", "app.booking-change.jobs-enabled=false", "bms.scheduler.match-sweep.enabled=false", "app.upload.dir=target/renewal-test-uploads"})
@Transactional
class ServiceRenewalApiTests {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired AccountRepository accounts;
    @Autowired LocationRepository locations;
    @Autowired CourtRepository courts;
    @Autowired ServiceTermRepository terms;
    @Autowired JwtTokenProvider jwt;
    @Autowired PackageService packages;
    MockMvc mvc;
    Account owner, admin;
    Location location;

    @BeforeEach void setup() throws Exception {
        try(var c=jdbc.getDataSource().getConnection()) { assertThat(c.getCatalog()).isEqualToIgnoringCase("BMS_Test"); }
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner=account(Role.OWNER); admin=account(Role.ADMIN);
        location=locations.saveAndFlush(Location.builder().ownerId(owner.getId()).name("Fixture gia hạn")
                .address("Hà Nội").latitude(BigDecimal.valueOf(21)).longitude(BigDecimal.valueOf(105)).contactPhone(owner.getPhone()).build());
        courts.saveAndFlush(Court.builder().locationId(location.getId()).name("Sân 1").active(false).build());
    }
    Account account(Role role) {
        String suffix=UUID.randomUUID().toString().replace("-", "").substring(0,12);
        return accounts.saveAndFlush(Account.builder().username("r"+suffix).email(suffix+"@example.com")
                .phone("0"+String.format("%09d",Math.floorMod(UUID.randomUUID().getMostSignificantBits(),1000000000L)))
                .fullName("Fixture").passwordHash("unused").role(role).status(AccountStatus.ACTIVE).build());
    }
    String token(Account a) { return "Bearer "+jwt.generateToken(a); }
    String path() { return "/api/owner/locations/"+location.getId()+"/service-renewals"; }
    void term(LocalDate end) {
        terms.saveAndFlush(ServiceTerm.builder().locationId(location.getId()).startDate(end.minusYears(1).plusDays(1))
                .endDate(end).recordedBy(admin.getId()).build());
    }
    long submit() throws Exception {
        var result=mvc.perform(get(path()+"/quote").param("years","1").header("Authorization",token(owner)))
                .andExpect(status().isOk()).andReturn();
        var quote=json.readTree(result.getResponse().getContentAsString()).get("data");
        var payload=Map.of("rentalYears",1,"quotedStart",quote.get("startDate").asText(),"quotedEnd",quote.get("endDate").asText(),
                "quotedAmount",quote.get("amount").decimalValue(),"termsAccepted",true);
        result=mvc.perform(multipart(path()).header("Authorization",token(owner))
                .file(new MockMultipartFile("data","","application/json",json.writeValueAsBytes(payload)))
                .file(new MockMultipartFile("proof","fixture.png","image/png",new byte[]{1,2,3})))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).at("/data/id").asLong();
    }
    @Test void activeRenewalExtendsLatestTermAndBookingLimitWithoutCreatingCourts() throws Exception {
        LocalDate old=LocalDate.now().plusMonths(2); term(old);
        long id=submit();
        mvc.perform(post("/api/admin/service-renewals/"+id+"/approve").header("Authorization",token(admin))
                .contentType("application/json").content("{\"paymentConfirmed\":false}")) .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/service-renewals/"+id+"/approve").header("Authorization",token(admin))
                .contentType("application/json").content("{\"paymentConfirmed\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.startDate").value(old.plusDays(1).toString()));
        assertThat(terms.findAllByLocationId(location.getId())).hasSize(2);
        assertThat(courts.findAllByLocationIdOrderByNameAsc(location.getId())).hasSize(1);
        assertThat(packages.lastBookablePackageDate(location.getId(),LocalDate.now())).isEqualTo(LocalDate.now().plusYears(1).minusDays(1));
        mvc.perform(post("/api/admin/service-renewals/"+id+"/approve").header("Authorization",token(admin))
                .contentType("application/json").content("{\"paymentConfirmed\":true}")) .andExpect(status().isConflict());
    }
    @Test void expiredLockedLocationCanRenewAndIsReopenedFromApprovalDate() throws Exception {
        term(LocalDate.now().minusDays(20)); location.setStatus("LOCKED"); locations.saveAndFlush(location);
        long id=submit();
        mvc.perform(post("/api/admin/service-renewals/"+id+"/approve").header("Authorization",token(admin))
                .contentType("application/json").content("{\"paymentConfirmed\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.startDate").value(LocalDate.now().toString()));
        assertThat(locations.findById(location.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        // Thông báo gia hạn trả đúng địa điểm để Owner có nhiều địa điểm mở đúng trang gia hạn.
        mvc.perform(get("/api/notifications").header("Authorization",token(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].refType").value("SERVICE_RENEWAL"))
                .andExpect(jsonPath("$.data.content[0].locationId").value(location.getId()));
    }
    @Test void rejectRequiresReasonThenOwnerCanSubmitAgain() throws Exception {
        term(LocalDate.now().plusMonths(1)); long id=submit();
        mvc.perform(post("/api/admin/service-renewals/"+id+"/reject").header("Authorization",token(admin))
                .contentType("application/json").content("{\"paymentConfirmed\":false,\"reason\":\"   \"}")) .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/service-renewals/"+id+"/reject").header("Authorization",token(admin))
                .contentType("application/json").content("{\"paymentConfirmed\":false,\"reason\":\"Thông tin cần bổ sung\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("REJECTED"));
        assertThat(submit()).isNotEqualTo(id);
    }
    @Test void otherOwnerCannotReadQuoteAndP10CannotBeChanged() throws Exception {
        mvc.perform(get(path()+"/quote").param("years","1").header("Authorization",token(account(Role.OWNER))))
                .andExpect(status().isForbidden());
        String update="/api/owner/locations/"+location.getId();
        mvc.perform(patch(update).header("Authorization",token(owner)).contentType("application/json")
                .content("{\"pointRedemptionValue\":1500}")) .andExpect(status().isBadRequest());
        mvc.perform(patch(update).header("Authorization",token(owner)).contentType("application/json")
                .content("{\"pointEarningRate\":5000}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.pointRedemptionValue").value(500));
        assertThat(jdbc.queryForObject("SELECT point_redemption_value FROM location WHERE id=?",Integer.class,location.getId())).isEqualTo(500);
    }
}
