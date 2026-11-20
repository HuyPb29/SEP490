package com.sep490.bms.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.entity.account.*;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.*;
import com.sep490.bms.security.JwtTokenProvider;
import com.sep490.bms.service.integration.FileStorageService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

/** Opt-in, cần migration court_expansion. Mọi dữ liệu test nằm trong transaction rollback; không gửi tiền/email. */
@SpringBootTest(properties={"bms.job.enabled=false", "app.booking-change.jobs-enabled=false", "bms.scheduler.match-sweep.enabled=false"})
@EnabledIfEnvironmentVariable(named="BMS_EXPANSION_INTEGRATION", matches="true")
@Transactional
class CourtExpansionApiTests {
    @Autowired WebApplicationContext context;
    @Autowired AccountRepository accounts;
    @Autowired LocationRepository locations;
    @Autowired ServiceTermRepository terms;
    @Autowired CourtRepository courts;
    @Autowired JwtTokenProvider jwt;
    @Autowired ObjectMapper json;
    @Autowired EntityManager em;
    @MockitoBean FileStorageService files;
    MockMvc mvc;
    Account owner, admin, other;
    Location location;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = account(Role.OWNER); admin = account(Role.ADMIN); other = account(Role.OWNER);
        location = locations.saveAndFlush(Location.builder().ownerId(owner.getId()).name("Kiểm thử thêm sân")
                .address("Địa điểm kiểm thử rollback").latitude(BigDecimal.valueOf(21)).longitude(BigDecimal.valueOf(105))
                .contactPhone(owner.getPhone()).build());
        terms.saveAndFlush(ServiceTerm.builder().locationId(location.getId()).startDate(LocalDate.now().minusDays(300))
                .endDate(LocalDate.now().plusDays(100)).recordedBy(admin.getId()).build());
        when(files.storeImage(any(), eq("court-expansion-proofs"))).thenReturn("test-proof.png");
    }
    private Account account(Role role) {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0,10);
        return accounts.saveAndFlush(Account.builder().username("e"+id).email(id+"@example.com")
                .phone("0"+String.format("%09d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(),1_000_000_000L)))
                .passwordHash("unused").fullName("Test thêm sân").role(role).status(AccountStatus.ACTIVE).build());
    }
    private String token(Account a) { return "Bearer " + jwt.generateToken(a); }
    private String path() { return "/api/owner/locations/"+location.getId()+"/court-expansions"; }
    private long submit() throws Exception {
        var response = mvc.perform(get(path()+"/quote").header("Authorization",token(owner)).param("courtCount","2"))
                .andExpect(status().isOk()).andReturn();
        var quote = json.readTree(response.getResponse().getContentAsString()).get("data");
        byte[] data = json.writeValueAsBytes(Map.of("courtCount",2,"quotedStart",quote.get("startDate").asText(),
                "contractEnd",quote.get("endDate").asText(),"quotedAmount",quote.get("amount").decimalValue()));
        var sent = mvc.perform(multipart(path()).file(new MockMultipartFile("data","data.json","application/json",data))
                        .file(new MockMultipartFile("proof","ck.png","image/png",new byte[]{1}))
                        .header("Authorization",token(owner)))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(sent.getResponse().getContentAsString()).at("/data/id").asLong();
    }
    @Test void submitApproveAndRepeatedApprovalUseActualSqlConstraints() throws Exception {
        long id = submit();
        assertThat(courts.findAllByLocationIdOrderByNameAsc(location.getId())).isEmpty();
        var listed = mvc.perform(get("/api/admin/court-expansions").header("Authorization",token(admin)))
                .andExpect(status().isOk()).andReturn();
        var rows = json.readTree(listed.getResponse().getContentAsString()).get("data");
        com.fasterxml.jackson.databind.JsonNode target = null;
        for (var row : rows) if (row.get("id").asLong()==id) target=row;
        assertThat(target).isNotNull();
        var quote = target.get("approvalQuote");
        String decision = json.writeValueAsString(Map.of("receivedAmount",quote.get("amount").decimalValue(),
                "refundedAmount",0,"effectiveStart",quote.get("startDate").asText(),"finalAmount",quote.get("amount").decimalValue()));
        mvc.perform(post("/api/admin/court-expansions/"+id+"/approve").header("Authorization",token(admin))
                .contentType("application/json").content(decision)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
        em.flush();
        assertThat(courts.findAllByLocationIdOrderByNameAsc(location.getId())).hasSize(2).allSatisfy(c -> {
            assertThat(c.getAvailableFrom()).isEqualTo(LocalDate.now().plusDays(1));
            assertThat(c.isActive()).isFalse();
        });
        mvc.perform(post("/api/admin/court-expansions/"+id+"/approve").header("Authorization",token(admin))
                .contentType("application/json").content(decision)).andExpect(status().isConflict());
    }
    @Test void ownerCannotSeeOthersQuoteAndCannotUseOldFreeCreationEndpoint() throws Exception {
        mvc.perform(get(path()+"/quote").header("Authorization",token(other)).param("courtCount","1"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/owner/locations/"+location.getId()+"/courts").header("Authorization",token(owner))
                .contentType("application/json").content("{\"name\":\"Sân miễn phí\"}"))
                .andExpect(status().isConflict());
        assertThat(courts.findAllByLocationIdOrderByNameAsc(location.getId())).isEmpty();
    }
    @Test void rejectingRequestRequiresRecordingFullRefundAndReason() throws Exception {
        long id = submit();
        mvc.perform(post("/api/admin/court-expansions/"+id+"/reject").header("Authorization",token(admin))
                .contentType("application/json").content("{\"receivedAmount\":1000,\"refundedAmount\":0,\"reason\":\"Sai chứng từ\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/court-expansions/"+id+"/reject").header("Authorization",token(admin))
                .contentType("application/json").content("{\"receivedAmount\":1000,\"refundedAmount\":1000,\"reason\":\"Sai chứng từ\",\"settlementNote\":\"Đã hoàn GD123\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("REJECTED"));
        em.flush();
        assertThat(courts.findAllByLocationIdOrderByNameAsc(location.getId())).isEmpty();
    }
}
