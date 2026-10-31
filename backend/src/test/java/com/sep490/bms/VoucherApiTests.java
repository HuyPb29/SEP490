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
    @Test void personalGrantIsPrivateAndCannotBeStolen() throws Exception {
        Voucher v=voucher(VoucherTargetGroup.SPECIFIED);
        var r=mvc.perform(post("/api/owner/vouchers/"+v.getId()+"/grants").header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"playerIds\":["+player.getId()+"]}"))
                .andExpect(status().isCreated()).andReturn();
        long grant=json.readTree(r.getResponse().getContentAsString()).at("/data/0/grantId").asLong();
        mvc.perform(get("/api/me/vouchers").header("Authorization",token(player))).andExpect(jsonPath("$.data.totalElements").value(1));
        mvc.perform(get("/api/me/vouchers").header("Authorization",token(other))).andExpect(jsonPath("$.data.totalElements").value(0));
        VoucherCheckRequest request=new VoucherCheckRequest(location.getId(),BigDecimal.valueOf(1000),new VoucherSelection(null,grant));
        mvc.perform(post("/api/vouchers/check").header("Authorization",token(other)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/vouchers/check").header("Authorization",token(player)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.discountAmount").value(100));
        assertThat(vouchers.findById(v.getId()).orElseThrow().getUsedCount()).isZero();
    }
    @Test void consumeRollbackIdempotencyAndRestoreGrant() {
        Voucher v=voucher(VoucherTargetGroup.SPECIFIED); Booking b=booking(player);
        VoucherGrant g=grants.saveAndFlush(VoucherGrant.builder().voucherId(v.getId()).playerId(player.getId()).expiresAt(LocalDateTime.now().plusDays(1)).build());
        VoucherSelection selection=new VoucherSelection(null,g.getId());
        assertThatThrownBy(() -> tx.execute(s -> { service.consumeForBooking(b.getId(),selection); throw new AppException("Simulated booking failure"); })).isInstanceOf(AppException.class);
        assertThat(vouchers.findById(v.getId()).orElseThrow().getUsedCount()).isZero(); assertThat(usages.findByBookingId(b.getId())).isEmpty();
        tx.executeWithoutResult(s -> { long first=service.consumeForBooking(b.getId(),selection).getId(); assertThat(service.consumeForBooking(b.getId(),selection).getId()).isEqualTo(first); });
        assertThat(vouchers.findById(v.getId()).orElseThrow().getUsedCount()).isEqualTo(1);
        assertThat(grants.findById(g.getId()).orElseThrow().getStatus()).isEqualTo(VoucherGrantStatus.USED);
        tx.executeWithoutResult(s -> { em.find(Booking.class,b.getId()).setStatus(BookingStatus.EXPIRED); service.restoreForFailedBooking(b.getId()); service.restoreForFailedBooking(b.getId()); });
        assertThat(vouchers.findById(v.getId()).orElseThrow().getBudgetUsed()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(grants.findById(g.getId()).orElseThrow().getStatus()).isEqualTo(VoucherGrantStatus.AVAILABLE);
        assertThat(usages.findByBookingId(b.getId()).orElseThrow().getStatus()).isEqualTo(VoucherUsageStatus.RETURNED);
    }
    @Test void concurrencyCannotOverspendLastUse() throws Exception {
        Voucher v=voucher(VoucherTargetGroup.ALL_PLAYERS); Booking a=booking(player),b=booking(other);
        var pool=Executors.newFixedThreadPool(2); var start=new CountDownLatch(1);
        java.util.function.Function<Long,Callable<Boolean>> consume=id -> () -> { start.await(); try { tx.execute(s -> service.consumeForBooking(id,new VoucherSelection(v.getCode(),null))); return true; } catch(AppException ex) { return false; } };
        try { var first=pool.submit(consume.apply(a.getId())); var second=pool.submit(consume.apply(b.getId())); start.countDown();
            assertThat(List.of(first.get(25,TimeUnit.SECONDS),second.get(25,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
            assertThat(vouchers.findById(v.getId()).orElseThrow().getUsedCount()).isEqualTo(1);
            assertThat(vouchers.findById(v.getId()).orElseThrow().getBudgetUsed()).isEqualByComparingTo("100");
        } finally { pool.shutdownNow(); pool.awaitTermination(10,TimeUnit.SECONDS); }
    }
    @Test void newPlayerAndMinimumAmountRules() {
        Voucher v=voucher(VoucherTargetGroup.NEW_PLAYERS);
        assertThatThrownBy(() -> service.check(UserPrincipal.create(player),new VoucherCheckRequest(location.getId(),BigDecimal.valueOf(100),new VoucherSelection(v.getCode(),null))))
                .isInstanceOf(AppException.class).hasMessageContaining("tối thiểu");
        Booking b=booking(player);
        assertThat(service.check(UserPrincipal.create(player),new VoucherCheckRequest(location.getId(),BigDecimal.valueOf(1000),new VoucherSelection(v.getCode(),null))).discountAmount()).isEqualByComparingTo("100");
        tx.executeWithoutResult(s -> em.find(Booking.class,b.getId()).setStatus(BookingStatus.CONFIRMED));
        assertThatThrownBy(() -> service.check(UserPrincipal.create(player),new VoucherCheckRequest(location.getId(),BigDecimal.valueOf(1000),new VoucherSelection(v.getCode(),null))))
                .isInstanceOf(AppException.class).hasMessageContaining("Player mới");
    }
    @Test void percentageExpiryBudgetAndPerPlayerLimits() {
        Voucher v=voucher(VoucherTargetGroup.ALL_PLAYERS);
        v.setDiscountType(DiscountType.PERCENT); v.setDiscountValue(BigDecimal.valueOf(33)); v.setBudget(BigDecimal.valueOf(1000)); v.setMaxTotalUses(5);
        v=vouchers.saveAndFlush(v);
        var request=new VoucherCheckRequest(location.getId(),BigDecimal.valueOf(1001),new VoucherSelection(v.getCode(),null));
        assertThat(service.check(UserPrincipal.create(player),request).discountAmount()).isEqualByComparingTo("330");
        v.setBudget(BigDecimal.valueOf(100)); v=vouchers.saveAndFlush(v);
        assertThatThrownBy(() -> service.check(UserPrincipal.create(player),request)).hasMessageContaining("ngân sách");
        v.setBudget(BigDecimal.valueOf(1000)); v.setValidTo(LocalDate.now().minusDays(1)); v=vouchers.saveAndFlush(v);
        assertThatThrownBy(() -> service.check(UserPrincipal.create(player),request)).hasMessageContaining("thời hạn");
        v.setValidTo(LocalDate.now().plusDays(1)); v=vouchers.saveAndFlush(v);
        Booking b=booking(player);
        tx.executeWithoutResult(s -> service.consumeForBooking(b.getId(),request.selection()));
        assertThatThrownBy(() -> service.check(UserPrincipal.create(player),request)).hasMessageContaining("cá nhân");
    }
    @Test void openApiContractAndInputValidation() throws Exception {
        String body=mvc.perform(get("/v3/api-docs/f6-vouchers")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode api=json.readTree(body);
        assertThat(api.at("/paths/~1api~1owner~1vouchers/post/responses/201").isMissingNode()).isFalse();
        assertThat(api.at("/paths/~1api~1locations~1{id}~1vouchers/get/security").size()).isZero();
        assertThat(api.at("/paths/~1api~1owner~1vouchers/post/parameters").toString()).contains("X-Location-Id");
        java.nio.file.Files.writeString(java.nio.file.Path.of("target/f6-openapi.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(api));
        mvc.perform(post("/api/owner/vouchers").header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"bad\",\"discountValue\":-1}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/locations/"+location.getId()+"/vouchers?size=101")).andExpect(status().isBadRequest());
    }
}
