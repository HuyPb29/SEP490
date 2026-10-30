package com.sep490.bms;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import java.math.BigDecimal;
import java.nio.file.*;
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
import com.sep490.bms.entity.booking.*;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.reschedule.*;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.repository.*;
import com.sep490.bms.repository.promotion.*;
import com.sep490.bms.security.*;
import com.sep490.bms.service.promotion.*;
import com.sep490.bms.exception.AppException;
import jakarta.persistence.EntityManager;

@SpringBootTest @TestInstance(TestInstance.Lifecycle.PER_CLASS)
class LoyaltyApiTests {
    @Autowired WebApplicationContext context;
    @Autowired ObjectMapper json;
    @Autowired AccountRepository accounts;
    @Autowired LocationRepository locations;
    @Autowired PlayerLocationBalanceRepository balances;
    @Autowired LoyaltyTierRepository tiers;
    @Autowired VoucherRepository vouchers;
    @Autowired VoucherGrantRepository grants;
    @Autowired JwtTokenProvider jwt;
    @Autowired LoyaltyPointService points;
    @Autowired PlatformTransactionManager manager;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc; TransactionTemplate tx;
    Account owner,player,other; Location location; Long court;
    List<Long> accountIds=new ArrayList<>();
    @BeforeAll void upgradeTestSchema() throws Exception {
        // Explicitly scoped to the existing integration test database. Never runs on a production catalog.
        try(var c=Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
            if(!"BMS_Test".equalsIgnoreCase(c.getCatalog())) throw new IllegalStateException("Loyalty regression requires BMS_Test");
            String sql=Files.readString(Path.of("db/migrations/20261030_uc25_uc26_loyalty.sql")).replace("\uFEFF", "");
            for(int pass=0;pass<2;pass++) {
                try { for(String batch:sql.split("(?im)^GO\\s*$")) if(!batch.isBlank()) try(var s=c.createStatement()) { s.execute(batch); } }
                catch(Exception e) { try(var s=c.createStatement()) { s.execute("IF @@TRANCOUNT>0 ROLLBACK TRANSACTION"); } throw e; }
            }
        }
    }
    @BeforeEach void setup() {
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build(); tx=new TransactionTemplate(manager);
        owner=account(Role.OWNER); player=account(Role.PLAYER); other=account(Role.PLAYER);
        location=locations.saveAndFlush(Location.builder().ownerId(owner.getId()).name("Loyalty test").address("Test")
                .contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE).build());
        court=tx.execute(s -> { var c=com.sep490.bms.entity.location.Court.builder().locationId(location.getId()).name("Loyalty court").active(true).build(); em.persist(c); em.flush(); return c.getId(); });
    }
    Account account(Role role) {
        String id=UUID.randomUUID().toString().replace("-", "").substring(0,12);
        Account a=accounts.saveAndFlush(Account.builder().username("l"+id).email(id+"@example.com").phone("0"+String.format("%09d",Math.floorMod((long)id.hashCode(),1000000000L)))
                .fullName("Loyalty Test").passwordHash("test-unused").role(role).status(AccountStatus.ACTIVE).build());
        accountIds.add(a.getId()); return a;
    }
    @AfterEach void cleanup() {
        Long id=location.getId();
        jdbc.update("DELETE FROM notification WHERE recipient_id IN (SELECT player_id FROM player_location_balance WHERE location_id=?)",id);
        jdbc.update("DELETE FROM loyalty_reward WHERE loyalty_tier_id IN (SELECT id FROM loyalty_tier WHERE location_id=?)",id);
        jdbc.update("DELETE FROM loyalty_accrual WHERE balance_id IN (SELECT id FROM player_location_balance WHERE location_id=?)",id);
        jdbc.update("DELETE FROM point_transaction WHERE balance_id IN (SELECT id FROM player_location_balance WHERE location_id=?)",id);
        jdbc.update("DELETE FROM player_location_balance WHERE location_id=?",id);
        jdbc.update("DELETE FROM voucher_usage WHERE voucher_id IN (SELECT id FROM voucher WHERE location_id=?)",id);
        jdbc.update("DELETE FROM loyalty_tier WHERE location_id=?",id);
        jdbc.update("DELETE FROM voucher_grant WHERE voucher_id IN (SELECT id FROM voucher WHERE location_id=?)",id);
        jdbc.update("DELETE FROM affected_booking WHERE booking_id IN (SELECT id FROM booking WHERE location_id=?)",id);
        jdbc.update("DELETE FROM payment WHERE location_id=?",id);
        jdbc.update("DELETE FROM reschedule_request WHERE booking_id IN (SELECT id FROM booking WHERE location_id=?)",id);
        jdbc.update("DELETE FROM booking WHERE location_id=?",id);
        jdbc.update("DELETE FROM booking_package WHERE location_id=?",id);
        jdbc.update("DELETE FROM voucher WHERE location_id=?",id);
        jdbc.update("DELETE FROM court WHERE location_id=?",id); locations.deleteById(id);
        for(Long a:accountIds) accounts.deleteById(a); accountIds.clear();
    }
    String token(Account a) { return "Bearer "+jwt.generateToken(a); }
    Booking booking(int amount) {
        return tx.execute(s -> { var b=Booking.builder().bookingCode("L"+UUID.randomUUID().toString().substring(0,12)).locationId(location.getId()).courtId(court)
                .playerId(player.getId()).bookingType(BookingType.SINGLE).playDate(LocalDate.now().plusDays(1)).startMinute(600).endMinute(660)
                .listAmount(BigDecimal.valueOf(amount)).finalAmount(BigDecimal.valueOf(amount)).holdExpiresAt(LocalDateTime.now().plusMinutes(5)).build(); em.persist(b); em.flush(); return b; });
    }
    PlayerLocationBalance balance() { return balances.findByPlayerIdAndLocationId(player.getId(),location.getId()).orElseThrow(); }
    void seed(int n) { balances.saveAndFlush(PlayerLocationBalance.builder().playerId(player.getId()).locationId(location.getId()).pointBalance(n).build()); }
    Payment payment(Booking b) {
        return tx.execute(s -> { em.find(Booking.class,b.getId()).setStatus(BookingStatus.CONFIRMED);
            var p=Payment.builder().locationId(location.getId()).bookingId(b.getId()).amountDue(b.getFinalAmount()).receivedAmount(b.getFinalAmount().add(BigDecimal.valueOf(99999)))
                    .status(PaymentStatus.CONFIRMED).confirmedBy(owner.getId()).confirmedAt(LocalDateTime.now()).build(); em.persist(p); em.flush(); return p; });
    }
    long configure(int threshold) throws Exception {
        String content=json.writeValueAsString(new LoyaltyMilestoneRequest(threshold,"Thank you",BigDecimal.valueOf(5000),10));
        var result=mvc.perform(post("/api/owner/loyalty-milestones").header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                .contentType(MediaType.APPLICATION_JSON).content(content)).andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).at("/data/id").asLong();
    }
    long affected(Booking b,AffectedChoice choice) {
        return tx.execute(s -> { em.find(Booking.class,b.getId()).setStatus(BookingStatus.CANCELLED_BY_FACILITY);
            var a=AffectedBooking.builder().bookingId(b.getId()).cause(AffectedCause.OWNER_CANCELLED).status(AffectedStatus.RESOLVED).choice(choice).createdBy(owner.getId()).chosenAt(LocalDateTime.now()).build(); em.persist(a); em.flush(); return a.getId(); });
    }
    @Test void balanceHistoryAdjustmentRbacAndPrivacy() throws Exception {
        Booking b=booking(10000);
        mvc.perform(get("/api/me/loyalty-balances")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/loyalty-balances").header("Authorization",token(owner))).andExpect(status().isForbidden());
        String body="{\"bookingId\":"+b.getId()+",\"points\":5,\"reason\":\"Service issue\"}";
        mvc.perform(post("/api/owner/loyalty-adjustments").header("Authorization",token(player)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/owner/loyalty-adjustments").header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andExpect(jsonPath("$.data.balanceAfter").value(5));
        mvc.perform(get("/api/me/loyalty-balances").header("Authorization",token(player))).andExpect(jsonPath("$.data.content[0].pointBalance").value(5));
        mvc.perform(get("/api/me/loyalty-transactions").header("Authorization",token(other))).andExpect(jsonPath("$.data.totalElements").value(0));
        mvc.perform(get("/api/me/loyalty-transactions?type=ADJUST&locationId="+location.getId()).header("Authorization",token(player))).andExpect(jsonPath("$.data.content[0].reason").value("Service issue"));
        mvc.perform(get("/api/me/loyalty-transactions?size=101").header("Authorization",token(player))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/owner/loyalty-adjustments").header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON).content(body.replace("\"points\":5","\"points\":-1"))).andExpect(status().isBadRequest());
        var foreign=locations.saveAndFlush(Location.builder().ownerId(owner.getId()).name("Other").address("Test").contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE).build());
        try { mvc.perform(post("/api/owner/loyalty-adjustments").header("Authorization",token(owner)).header("X-Location-Id",foreign.getId()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden()); }
        finally { locations.deleteById(foreign.getId()); }
    }
    @Test void paymentAccrualIsAtomicIdempotentAndCountsSessions() throws Exception {
        configure(2); Booking first=booking(19999); Payment p=payment(first);
        assertThatThrownBy(() -> tx.execute(s -> { points.accrueForConfirmedPayment(p.getId()); throw new AppException("rollback"); })).isInstanceOf(AppException.class);
        assertThat(balances.findByPlayerIdAndLocationId(player.getId(),location.getId())).isEmpty();
        tx.executeWithoutResult(s -> { points.accrueForConfirmedPayment(p.getId()); points.accrueForConfirmedPayment(p.getId()); });
        assertThat(balance().getPointBalance()).isEqualTo(1); assertThat(balance().getLoyaltySessions()).isEqualTo(1);
        assertThat(balance().getTotalPaid()).isEqualByComparingTo("19999");
        Payment second=payment(booking(999));
        tx.executeWithoutResult(s -> { points.accrueForConfirmedPayment(second.getId()); points.accrueForConfirmedPayment(second.getId()); });
        assertThat(balance().getPointBalance()).isEqualTo(1); assertThat(balance().getLoyaltySessions()).isZero();
        assertThat(grants.findByPlayerId(player.getId(),org.springframework.data.domain.Pageable.unpaged()).getTotalElements()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loyalty_accrual WHERE balance_id=?",Integer.class,balance().getId())).isEqualTo(2);
        mvc.perform(get("/api/me/vouchers").header("Authorization",token(player))).andExpect(jsonPath("$.data.content[0].voucher.source").value("LOYALTY"));
    }
    @Test void redeemRollbackRetryAndFailedReturn() {
        seed(10); Booking b=booking(10000);
        assertThatThrownBy(() -> tx.execute(s -> { points.redeemForBooking(b.getId(),2); throw new AppException("rollback"); })).isInstanceOf(AppException.class);
        assertThat(balance().getPointBalance()).isEqualTo(10);
        tx.executeWithoutResult(s -> { assertThat(points.redeemForBooking(b.getId(),2)).isEqualByComparingTo("1000"); points.redeemForBooking(b.getId(),2); });
        assertThat(balance().getPointBalance()).isEqualTo(8);
        assertThatThrownBy(() -> tx.execute(s -> points.redeemForBooking(b.getId(),1))).isInstanceOf(AppException.class);
        tx.executeWithoutResult(s -> { em.find(Booking.class,b.getId()).setStatus(BookingStatus.EXPIRED); points.restoreForFailedBooking(b.getId()); points.restoreForFailedBooking(b.getId()); });
        assertThat(balance().getPointBalance()).isEqualTo(10);
        Booking cancelled=booking(10000);
        tx.executeWithoutResult(s -> { points.redeemForBooking(cancelled.getId(),2); em.find(Booking.class,cancelled.getId()).setStatus(BookingStatus.CANCELLED_BY_PLAYER); });
        assertThatThrownBy(() -> tx.execute(s -> { points.restoreForFailedBooking(cancelled.getId()); return null; })).hasMessageContaining("Chỉ hoàn");
        assertThat(balance().getPointBalance()).isEqualTo(8);
    }
    @Test void concurrentSpendingCannotOverdraw() throws Exception {
        seed(3); Booking a=booking(10000),b=booking(10000);
        var pool=Executors.newFixedThreadPool(2); var start=new CountDownLatch(1);
        java.util.function.Function<Long,Callable<Boolean>> call=id -> () -> { start.await(); try { tx.execute(s -> points.redeemForBooking(id,2)); return true; } catch(AppException e) { return false; } };
        try { var x=pool.submit(call.apply(a.getId())); var y=pool.submit(call.apply(b.getId())); start.countDown();
            assertThat(List.of(x.get(25,TimeUnit.SECONDS),y.get(25,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
            assertThat(balance().getPointBalance()).isEqualTo(1);
        } finally { pool.shutdownNow(); pool.awaitTermination(10,TimeUnit.SECONDS); }
    }
    @Test void facilityRefundClampsRevocationAndKeepsRewardVoucher() throws Exception {
        configure(1); Booking b=booking(20000); Payment p=payment(b);
        tx.executeWithoutResult(s -> points.accrueForConfirmedPayment(p.getId()));
        // Simulate points already spent on a separate booking.
        Booking spend=booking(2000); tx.executeWithoutResult(s -> points.redeemForBooking(spend.getId(),2));
        long a=affected(b,AffectedChoice.REFUND);
        tx.executeWithoutResult(s -> { points.settleFacilityCancellation(a); points.settleFacilityCancellation(a); });
        assertThat(balance().getPointBalance()).isZero(); assertThat(balance().getLoyaltySessions()).isZero();
        assertThat(grants.findByPlayerId(player.getId(),org.springframework.data.domain.Pageable.unpaged()).getTotalElements()).isEqualTo(1);
        assertThat(balance().getTotalPaid()).isEqualByComparingTo("0");
    }
    @Test void compensationRoundsUpReturnsSpentAndDoesNotRevokeEarnings() {
        seed(2); Booking b=booking(2251);
        tx.executeWithoutResult(s -> points.redeemForBooking(b.getId(),2));
        Booking updated=tx.execute(s -> em.find(Booking.class,b.getId()));
        Payment p=payment(updated); tx.executeWithoutResult(s -> points.accrueForConfirmedPayment(p.getId()));
        long a=affected(b,AffectedChoice.POINTS);
        tx.executeWithoutResult(s -> { points.settleFacilityCancellation(a); points.settleFacilityCancellation(a); });
        assertThat(balance().getPointBalance()).isEqualTo(5); // return 2 + ceil(1251/500)=3
        assertThat(balance().getLoyaltySessions()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM notification WHERE recipient_id=?",Integer.class,player.getId())).isEqualTo(1);
    }
    @Test void milestoneVersionAndExistingGrantValueArePreserved() throws Exception {
        long id=configure(1); Payment p=payment(booking(10000)); tx.executeWithoutResult(s -> points.accrueForConfirmedPayment(p.getId()));
        VoucherGrant g=grants.findByPlayerId(player.getId(),org.springframework.data.domain.Pageable.unpaged()).getContent().get(0);
        String body=json.writeValueAsString(new LoyaltyMilestoneUpdateRequest(0,true,new LoyaltyMilestoneRequest(3,"New reward",BigDecimal.valueOf(8000),20)));
        mvc.perform(patch("/api/owner/loyalty-milestones/"+id).header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk()).andExpect(jsonPath("$.data.sessionThreshold").value(3));
        mvc.perform(patch("/api/owner/loyalty-milestones/"+id).header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        assertThat(vouchers.findById(g.getVoucherId()).orElseThrow().getDiscountValue()).isEqualByComparingTo("5000");
        mvc.perform(get("/api/owner/loyalty-milestones").header("Authorization",token(owner)).header("X-Location-Id",location.getId())).andExpect(jsonPath("$.data[0].version").value(1));
    }

    @Test void packageAccruesAllSessionsOnceAndRescheduleEarnsWithoutCountingAgain() throws Exception {
        configure(3);
        Booking one=booking(10000),two=booking(10000);
        Long pkg=tx.execute(s -> {
            BookingPackage p=BookingPackage.builder().locationId(location.getId()).playerId(player.getId()).packageType(PackageType.CUSTOM)
                    .startDate(LocalDate.now().plusDays(1)).endDate(LocalDate.now().plusDays(2)).listAmount(BigDecimal.valueOf(20000))
                    .finalAmount(BigDecimal.valueOf(20000)).status(BookingStatus.CONFIRMED).build(); em.persist(p); em.flush();
            for(Long id:List.of(one.getId(),two.getId())) { Booking b=em.find(Booking.class,id); b.setPackageId(p.getId()); b.setBookingType(BookingType.SESSION); b.setStatus(BookingStatus.CONFIRMED); }
            return p.getId();
        });
        Long paymentId=tx.execute(s -> { Payment p=Payment.builder().locationId(location.getId()).packageId(pkg).amountDue(BigDecimal.valueOf(20000)).status(PaymentStatus.CONFIRMED).confirmedBy(owner.getId()).build(); em.persist(p); em.flush(); return p.getId(); });
        tx.executeWithoutResult(s -> { points.accrueForConfirmedPayment(paymentId); points.accrueForConfirmedPayment(paymentId); });
        assertThat(balance().getLoyaltySessions()).isEqualTo(2); assertThat(balance().getPointBalance()).isEqualTo(2);
        Long extraPayment=tx.execute(s -> {
            RescheduleRequest r=RescheduleRequest.builder().bookingId(one.getId()).newCourtId(court).newDate(LocalDate.now().plusDays(2)).newStartMinute(600).newEndMinute(660)
                    .oldListAmount(BigDecimal.valueOf(10000)).newListAmount(BigDecimal.valueOf(30000)).extraAmount(BigDecimal.valueOf(20000)).status(RescheduleStatus.APPROVED).build(); em.persist(r); em.flush();
            Payment p=Payment.builder().locationId(location.getId()).rescheduleRequestId(r.getId()).amountDue(BigDecimal.valueOf(20000)).status(PaymentStatus.CONFIRMED).confirmedBy(owner.getId()).build(); em.persist(p); em.flush(); return p.getId();
        });
        tx.executeWithoutResult(s -> { points.accrueForConfirmedPayment(extraPayment); points.accrueForConfirmedPayment(extraPayment); });
        assertThat(balance().getPointBalance()).isEqualTo(4); assertThat(balance().getLoyaltySessions()).isEqualTo(2);
        Payment last=payment(booking(10000)); tx.executeWithoutResult(s -> points.accrueForConfirmedPayment(last.getId()));
        assertThat(balance().getLoyaltySessions()).isZero();
        assertThat(grants.findByPlayerId(player.getId(),org.springframework.data.domain.Pageable.unpaged()).getTotalElements()).isEqualTo(1);
    }
    @Test void voucherPointsPolicyAndMinimumAreEnforced() {
        seed(20); Booking b=booking(10000);
        Voucher v=vouchers.saveAndFlush(Voucher.builder().locationId(location.getId()).name("Policy test").source(VoucherSource.CAMPAIGN)
                .targetGroup(VoucherTargetGroup.ALL_PLAYERS).code("STACK").status(VoucherStatus.PUBLISHED).discountType(DiscountType.AMOUNT)
                .discountValue(BigDecimal.valueOf(2000)).allowPoints(true).maxPointPercent(25).build());
        tx.executeWithoutResult(s -> {
            Booking target=em.find(Booking.class,b.getId()); target.setVoucherDiscount(BigDecimal.valueOf(2000)); target.setFinalAmount(BigDecimal.valueOf(8000));
            em.persist(VoucherUsage.builder().voucherId(v.getId()).playerId(player.getId()).bookingId(b.getId()).discountAmount(BigDecimal.valueOf(2000)).build());
        });
        assertThatThrownBy(() -> tx.execute(s -> points.redeemForBooking(b.getId(),5))).hasMessageContaining("MSG38");
        assertThatThrownBy(() -> tx.execute(s -> points.redeemForBooking(b.getId(),1))).hasMessageContaining("MSG37");
        tx.executeWithoutResult(s -> points.redeemForBooking(b.getId(),4));
        assertThat(balance().getPointBalance()).isEqualTo(16);
        assertThat(tx.<BigDecimal>execute(s -> em.find(Booking.class,b.getId()).getFinalAmount())).isEqualByComparingTo("6000");
        Voucher blocked=vouchers.saveAndFlush(Voucher.builder().locationId(location.getId()).name("No stack").source(VoucherSource.LOYALTY)
                .targetGroup(VoucherTargetGroup.SPECIFIED).status(VoucherStatus.PUBLISHED).discountType(DiscountType.AMOUNT).discountValue(BigDecimal.valueOf(1000)).build());
        assertThatThrownBy(() -> points.preview(player.getId(),location.getId(),BigDecimal.valueOf(8000),blocked.getId(),2)).hasMessageContaining("MSG38");
    }
    @Test void packageRedeemAndFailedReturnAreIdempotent() {
        seed(10); Booking one=booking(10000),two=booking(10000);
        Long pkg=tx.execute(s -> {
            BookingPackage p=BookingPackage.builder().locationId(location.getId()).playerId(player.getId()).packageType(PackageType.CUSTOM)
                    .startDate(LocalDate.now().plusDays(1)).endDate(LocalDate.now().plusDays(2)).listAmount(BigDecimal.valueOf(20000))
                    .finalAmount(BigDecimal.valueOf(20000)).holdExpiresAt(LocalDateTime.now().plusMinutes(5)).build(); em.persist(p); em.flush();
            for(Long id:List.of(one.getId(),two.getId())) { Booking b=em.find(Booking.class,id); b.setPackageId(p.getId()); b.setBookingType(BookingType.SESSION); }
            return p.getId();
        });
        tx.executeWithoutResult(s -> { points.redeemForPackage(pkg,4); points.redeemForPackage(pkg,4); });
        assertThat(balance().getPointBalance()).isEqualTo(6);
        tx.executeWithoutResult(s -> { em.find(BookingPackage.class,pkg).setStatus(BookingStatus.PAYMENT_REJECTED); points.restoreForFailedPackage(pkg); points.restoreForFailedPackage(pkg); });
        assertThat(balance().getPointBalance()).isEqualTo(10);
        assertThatThrownBy(() -> tx.execute(s -> points.redeemForBooking(one.getId(),2))).hasMessageContaining("MSG40");
    }


    @Test void concurrentConfirmationCreatesOneBalanceAndOneReward() throws Exception {
        configure(1); Payment payment=payment(booking(10000));
        var pool=Executors.newFixedThreadPool(2); var start=new CountDownLatch(1);
        Callable<Void> call=() -> { start.await(); tx.executeWithoutResult(s -> points.accrueForConfirmedPayment(payment.getId())); return null; };
        try { var x=pool.submit(call); var y=pool.submit(call); start.countDown(); x.get(25,TimeUnit.SECONDS); y.get(25,TimeUnit.SECONDS);
            assertThat(balance().getPointBalance()).isEqualTo(1);
            assertThat(grants.findByPlayerId(player.getId(),org.springframework.data.domain.Pageable.unpaged()).getTotalElements()).isEqualTo(1);
        } finally { pool.shutdownNow(); pool.awaitTermination(10,TimeUnit.SECONDS); }
    }
    @Test void partialPackageRefundReturnsOnlyAllocatedPointsAndOneSession() {
        seed(10); Booking one=booking(10000),two=booking(10000);
        Long pkg=tx.execute(s -> {
            BookingPackage p=BookingPackage.builder().locationId(location.getId()).playerId(player.getId()).packageType(PackageType.CUSTOM)
                    .startDate(LocalDate.now().plusDays(1)).endDate(LocalDate.now().plusDays(2)).listAmount(BigDecimal.valueOf(20000))
                    .finalAmount(BigDecimal.valueOf(20000)).holdExpiresAt(LocalDateTime.now().plusMinutes(5)).build(); em.persist(p); em.flush();
            points.redeemForPackage(p.getId(),4);
            for(Long id:List.of(one.getId(),two.getId())) { Booking b=em.find(Booking.class,id); b.setPackageId(p.getId()); b.setBookingType(BookingType.SESSION);
                b.setPointsUsed(2); b.setPointDiscount(BigDecimal.valueOf(1000)); b.setFinalAmount(BigDecimal.valueOf(9000)); b.setStatus(BookingStatus.CONFIRMED); }
            p.setStatus(BookingStatus.CONFIRMED); return p.getId();
        });
        Long paymentId=tx.execute(s -> { Payment p=Payment.builder().locationId(location.getId()).packageId(pkg).amountDue(BigDecimal.valueOf(18000)).status(PaymentStatus.CONFIRMED).build(); em.persist(p); em.flush(); return p.getId(); });
        tx.executeWithoutResult(s -> points.accrueForConfirmedPayment(paymentId));
        assertThat(balance().getPointBalance()).isEqualTo(7); assertThat(balance().getLoyaltySessions()).isEqualTo(2);
        long a=affected(one,AffectedChoice.REFUND); tx.executeWithoutResult(s -> { points.settleFacilityCancellation(a); points.settleFacilityCancellation(a); });
        assertThat(balance().getPointBalance()).isEqualTo(9); assertThat(balance().getLoyaltySessions()).isEqualTo(1);
        assertThat(balance().getTotalPaid()).isEqualByComparingTo("9000");
    }
    @Test void openApiIncludesSixRoutesAndOwnerLocationHeader() throws Exception {
        String body=mvc.perform(get("/v3/api-docs/f6-loyalty")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode api=json.readTree(body);
        assertThat(api.path("paths").size()).isEqualTo(5); // six operations, GET/POST share one path
        assertThat(api.at("/paths/~1api~1owner~1loyalty-milestones/post/responses/201").isMissingNode()).isFalse();
        assertThat(api.at("/paths/~1api~1owner~1loyalty-adjustments/post/parameters").toString()).contains("X-Location-Id");
        Files.writeString(Path.of("target/f6-loyalty-openapi.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(api));
    }

}