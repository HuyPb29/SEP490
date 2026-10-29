package com.sep490.bms;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.context.WebApplicationContext;
import com.fasterxml.jackson.databind.*;
import com.sep490.bms.entity.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.repository.*;
import com.sep490.bms.repository.promotion.*;
import com.sep490.bms.security.*;
import com.sep490.bms.service.promotion.VoucherService;
import com.sep490.bms.exception.AppException;
import jakarta.persistence.EntityManager;

@SpringBootTest
class VoucherApiTests {
    @Autowired WebApplicationContext context;
    @Autowired ObjectMapper json;
    @Autowired AccountRepository accounts;
    @Autowired LocationRepository locations;
    @Autowired VoucherRepository vouchers;
    @Autowired VoucherUsageRepository usages;
    @Autowired VoucherGrantRepository grants;
    @Autowired JwtTokenProvider jwt;
    @Autowired VoucherService service;
    @Autowired PlatformTransactionManager manager;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc;
    TransactionTemplate tx;
    Account owner,admin,player,other;
    Location location;
    Long courtId;
    List<Long> accountIds=new ArrayList<>();
    String suffix=UUID.randomUUID().toString().substring(0,8);

    @BeforeEach void setup() {
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        tx=new TransactionTemplate(manager);
        owner=account(Role.OWNER); admin=account(Role.ADMIN); player=account(Role.PLAYER); other=account(Role.PLAYER);
        location=locations.saveAndFlush(Location.builder().ownerId(owner.getId()).name("Voucher test").address("Test address")
                .contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE).build());
        courtId=tx.execute(s -> { Court c=Court.builder().locationId(location.getId()).name("Test court").active(true).build(); em.persist(c); em.flush(); return c.getId(); });
    }
    private Account account(Role role) {
        String id=UUID.randomUUID().toString().replace("-", "").substring(0,12);
        Account a=accounts.saveAndFlush(Account.builder().username("v"+id).email(id+"@example.com")
                .phone("0"+String.format("%09d",Math.floorMod((long)id.hashCode(),1000000000L)))
                .fullName("Voucher Test").passwordHash("test-only-unused-hash").role(role).status(AccountStatus.ACTIVE).build());
        accountIds.add(a.getId()); return a;
    }
    @AfterEach void cleanup() {
        if(location!=null) {
            Long id=location.getId();
            jdbc.update("DELETE FROM voucher_usage WHERE voucher_id IN (SELECT id FROM voucher WHERE location_id=?)",id);
            jdbc.update("DELETE FROM voucher_grant WHERE voucher_id IN (SELECT id FROM voucher WHERE location_id=?)",id);
            jdbc.update("DELETE FROM booking WHERE location_id=?",id);
            jdbc.update("DELETE FROM voucher WHERE location_id=?",id);
            jdbc.update("DELETE FROM court WHERE location_id=?",id);
            jdbc.update("DELETE FROM location WHERE id=?",id);
        }
        for(Long id:accountIds) accounts.deleteById(id);
    }
    private String token(Account a) { return "Bearer "+jwt.generateToken(a); }
    private VoucherWriteRequest write(String code,VoucherTargetGroup target) {
        return new VoucherWriteRequest(code,"Test voucher",target,DiscountType.AMOUNT,BigDecimal.valueOf(100),BigDecimal.valueOf(500),
                LocalDate.now().minusDays(1),LocalDate.now().plusDays(10),3,1,2,BigDecimal.valueOf(200));
    }
    private Voucher voucher(VoucherTargetGroup target) {
        return vouchers.saveAndFlush(Voucher.builder().locationId(location.getId()).code(target==VoucherTargetGroup.SPECIFIED?null:"V"+suffix)
                .name("Test voucher").source(VoucherSource.CAMPAIGN).targetGroup(target).discountType(DiscountType.AMOUNT)
                .discountValue(BigDecimal.valueOf(100)).minOrderAmount(BigDecimal.valueOf(500)).validFrom(LocalDate.now().minusDays(1))
                .validTo(LocalDate.now().plusDays(10)).status(VoucherStatus.PUBLISHED).maxTotalUses(1).maxUsesPerPlayer(1).budget(BigDecimal.valueOf(100)).build());
    }
    private Booking booking(Account a) {
        return tx.execute(s -> { Booking b=Booking.builder().bookingCode("V"+UUID.randomUUID().toString().substring(0,12))
                .locationId(location.getId()).courtId(courtId).playerId(a.getId()).bookingType(BookingType.SINGLE)
                .playDate(LocalDate.now().plusDays(1)).startMinute(600).endMinute(660).listAmount(BigDecimal.valueOf(1000))
                .finalAmount(BigDecimal.valueOf(1000)).holdExpiresAt(LocalDateTime.now().plusMinutes(10)).build(); em.persist(b); em.flush(); return b; });
    }
    @Test void ownerLifecycleRbacAndTenantScope() throws Exception {
        var created=mvc.perform(post("/api/owner/vouchers").header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(write("SAVE"+suffix,VoucherTargetGroup.ALL_PLAYERS))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.status").value("DRAFT")).andReturn();
        JsonNode node=json.readTree(created.getResponse().getContentAsString()).path("data"); long id=node.path("id").asLong();
        mvc.perform(get("/api/locations/"+location.getId()+"/vouchers")).andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(0));
        mvc.perform(patch("/api/owner/vouchers/"+id).header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new VoucherUpdateRequest(node.path("version").asInt(),write("SAVE"+suffix,VoucherTargetGroup.ALL_PLAYERS)))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/owner/vouchers/"+id+"/publish").header("Authorization",token(owner)).header("X-Location-Id",location.getId())).andExpect(status().isOk());
        mvc.perform(patch("/api/owner/vouchers/"+id).header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new VoucherUpdateRequest(0,write("SAVE"+suffix,VoucherTargetGroup.ALL_PLAYERS)))))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/locations/"+location.getId()+"/vouchers")).andExpect(jsonPath("$.data.totalElements").value(1));
        mvc.perform(post("/api/admin/vouchers/"+id+"/disable").header("Authorization",token(owner))).andExpect(status().isForbidden());
        mvc.perform(post("/api/owner/vouchers/"+id+"/publish").header("Authorization",token(player))).andExpect(status().isForbidden());
        // Valid location header cannot authorize a voucher belonging to another facility.
        Voucher foreign=voucher(VoucherTargetGroup.ALL_PLAYERS);
        Location second=locations.saveAndFlush(Location.builder().ownerId(owner.getId()).name("Other").address("Other")
                .contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE).build());
        try { mvc.perform(post("/api/owner/vouchers/"+foreign.getId()+"/publish").header("Authorization",token(owner)).header("X-Location-Id",second.getId())).andExpect(status().isForbidden()); }
        finally { locations.deleteById(second.getId()); }
        mvc.perform(post("/api/admin/vouchers/"+id+"/disable").header("Authorization",token(admin))).andExpect(status().isOk());
        mvc.perform(get("/api/locations/"+location.getId()+"/vouchers")).andExpect(jsonPath("$.data.content[?(@.id == "+id+")]").isEmpty());
    }
}
