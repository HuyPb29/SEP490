package com.sep490.bms.integration;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.booking.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.security.JwtTokenProvider;
import com.sep490.bms.service.booking.PackageService;
import com.sep490.bms.service.payment.PaymentService;
import com.sep490.bms.scheduler.BookingStatusJob;
import com.sep490.bms.service.reschedule.CancellationService;
import com.sep490.bms.service.account.AccountMaintenanceService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

/** Requires the additive migration on BMS_Test. Fixtures roll back; no production catalog is accepted. */
@SpringBootTest(properties={"bms.job.enabled=false","app.booking-change.jobs-enabled=false","bms.scheduler.match-sweep.enabled=false","app.upload.dir=target/srs-v18-test-uploads"})
@Transactional
class SrsV18IntegrationTests {
    @Autowired WebApplicationContext context;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired AccountRepository accounts;
    @Autowired JwtTokenProvider jwt;
    @Autowired PackageService packages;
    @Autowired PaymentService payments;
    @Autowired CancellationService cancellations;
    @Autowired AccountMaintenanceService maintenance;
    @Autowired com.sep490.bms.service.promotion.LoyaltyPointService points;
    MockMvc mvc; Account owner,player,staff; Location location; Court court; Voucher voucher;
    @BeforeEach void fixtures() throws Exception {
        try(var c=Objects.requireNonNull(jdbc.getDataSource()).getConnection()) { assertThat(c.getCatalog()).isEqualToIgnoringCase("BMS_Test"); }
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner=account(Role.OWNER,null);player=account(Role.PLAYER,null);
        location=Location.builder().ownerId(owner.getId()).name("SRS v18 test").address("Test").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE)
                .contactPhone("0987654321").pointEarningRate(5000).build();em.persist(location);em.flush();
        staff=account(Role.STAFF,location.getId());
        court=Court.builder().locationId(location.getId()).name("SRS court").active(true).build();em.persist(court);em.flush();
        for(int d=1;d<=7;d++) em.persist(OpeningHour.builder().locationId(location.getId()).dayOfWeek(d).openMinute(0).closeMinute(1440).build());
        em.persist(PriceRule.builder().courtId(court.getId()).applyDays("1111111").startMinute(0).endMinute(1440).validFrom(LocalDate.now())
                .validTo(LocalDate.now().plusMonths(4)).pricePerSlot(new BigDecimal("5000")).build());
        em.persist(PlayerLocationBalance.builder().playerId(player.getId()).locationId(location.getId()).pointBalance(10).build());
        voucher=Voucher.builder().locationId(location.getId()).code("SRS").name("SRS voucher").source(VoucherSource.CAMPAIGN).targetGroup(VoucherTargetGroup.ALL_PLAYERS)
                .discountType(DiscountType.AMOUNT).discountValue(new BigDecimal("1000")).status(VoucherStatus.PUBLISHED).build();em.persist(voucher);em.flush();
    }
    Account account(Role role,Long locationId) {
        String suffix=UUID.randomUUID().toString().replace("-","").substring(0,12);
        return accounts.saveAndFlush(Account.builder().username("s"+suffix).email(role==Role.STAFF?null:suffix+"@example.com")
                .phone("0"+String.format("%09d",Math.floorMod(UUID.randomUUID().getMostSignificantBits(),1000000000L)))
                .fullName("SRS Test").passwordHash("test-only-unused").role(role).locationId(locationId).status(AccountStatus.ACTIVE).build());
    }
    String token(Account a) { return "Bearer "+jwt.generateToken(a); }
    Long createPackage() throws Exception {
        LocalDate first=LocalDate.now().plusDays(2);
        String body=json.writeValueAsString(Map.of("courtId",court.getId(),"packageType","CUSTOM","startDate",first.toString(),"endDate",first.plusDays(1).toString(),
                "sessions",List.of(Map.of("courtId",court.getId(),"date",first.toString(),"startMinute",600,"endMinute",660),
                        Map.of("courtId",court.getId(),"date",first.plusDays(1).toString(),"startMinute",600,"endMinute",660)),"voucherCode","SRS","pointsToUse",2));
        var result=mvc.perform(post("/api/booking-packages").header("Authorization",token(player)).contentType("application/json").content(body))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).at("/data/id").asLong();
    }
    PlayerLocationBalance wallet() {
        return em.createQuery("select b from PlayerLocationBalance b where b.playerId=:p and b.locationId=:l",PlayerLocationBalance.class)
                .setParameter("p",player.getId()).setParameter("l",location.getId()).getSingleResult();
    }
    @Test void packagePaymentConfirmsAllSessionsAndUsesVenueRate() throws Exception {
        Long id=createPackage();assertThat(wallet().getPointBalance()).isEqualTo(8);
        var proof=new MockMultipartFile("proof","proof.png","image/png",new byte[]{1,2});
        var sent=mvc.perform(multipart("/api/booking-packages/"+id+"/payments").file(proof).header("Authorization",token(player))).andExpect(status().isCreated()).andReturn();
        Long pay=json.readTree(sent.getResponse().getContentAsString()).at("/data/id").asLong();
        mvc.perform(post("/api/staff/payments/"+pay+"/confirm").header("Authorization",token(owner)).header("X-Location-Id",location.getId())).andExpect(status().isOk());
        assertThat(wallet().getTotalPaid()).isEqualByComparingTo("18000");assertThat(wallet().getPointBalance()).isEqualTo(11);
        assertThat(em.createQuery("select b.status from Booking b where b.packageId=:p",BookingStatus.class).setParameter("p",id).getResultList())
                .containsOnly(BookingStatus.CONFIRMED).hasSize(2);
        assertThat(em.createQuery("select sum(b.finalAmount) from Booking b where b.packageId=:p",BigDecimal.class).setParameter("p",id).getSingleResult()).isEqualByComparingTo("18000");
    }
    @Test void expiredPackageRestoresSingleVoucherUsageAndPointsExactlyOnce() throws Exception {
        Long id=createPackage();em.find(BookingPackage.class,id).setHoldExpiresAt(LocalDateTime.now().minusMinutes(1));em.flush();
        assertThat(packages.expireHold(id, LocalDateTime.now())).isTrue();
        assertThat(packages.expireHold(id, LocalDateTime.now())).isFalse();
        assertThat(wallet().getPointBalance()).isEqualTo(10);assertThat(voucher.getUsedCount()).isZero();
        assertThat(em.createQuery("select u.status from VoucherUsage u where u.packageId=:p",VoucherUsageStatus.class).setParameter("p",id).getSingleResult()).isEqualTo(VoucherUsageStatus.RETURNED);
    }
    @Test void reportedPackageExpiresAtFirstSessionEndAndRestoresBenefitsOnce() throws Exception {
        Long id = createPackage();
        var proof = new MockMultipartFile("proof", "proof.png", "image/png", new byte[]{1, 2});
        var result = mvc.perform(multipart("/api/booking-packages/" + id + "/payments")
                .file(proof).header("Authorization", token(player))).andExpect(status().isCreated()).andReturn();
        long paymentId = json.readTree(result.getResponse().getContentAsString()).at("/data/id").asLong();
        LocalDateTime deadline = packages.firstSessionEnd(id);

        assertThat(payments.expirePackagePayment(paymentId, deadline.minusSeconds(1))).isFalse();
        assertThat(payments.expirePackagePayment(paymentId, deadline)).isTrue();
        assertThat(payments.expirePackagePayment(paymentId, deadline)).isFalse();
        assertThat(em.find(BookingPackage.class, id).getStatus()).isEqualTo(BookingStatus.PAYMENT_REJECTED);
        assertThat(wallet().getPointBalance()).isEqualTo(10);
        assertThat(voucher.getUsedCount()).isZero();
    }
    @Test void staffWalkInCreationAndConfirmationDoNotUsePlayerPoints() throws Exception {
        var request=Map.of("courtId",court.getId(),"date",LocalDate.now().plusDays(1).toString(),"startMinute",600,"endMinute",660,"customerName","Khách tại quầy","customerPhone","0912345678");
        var result=mvc.perform(post("/api/staff/bookings").header("Authorization",token(staff)).contentType("application/json").content(json.writeValueAsString(request))).andExpect(status().isCreated()).andReturn();
        Long id=json.readTree(result.getResponse().getContentAsString()).at("/data/id").asLong();
        mvc.perform(post("/api/staff/bookings/"+id+"/confirm").header("Authorization",token(staff))).andExpect(status().isOk());
        assertThat(em.find(Booking.class,id).getPlayerId()).isNull();assertThat(wallet().getPointBalance()).isEqualTo(10);
        mvc.perform(post("/api/staff/complaints").header("Authorization",token(staff)).contentType("application/json")
                .content(json.writeValueAsString(Map.of("bookingId",id,"complaintType","COURT_SERVICE","content","Sân phải hủy lịch")))).andExpect(status().isCreated());
    }
    @Test void temporaryUnlockNeverUnlocksAnAdminLockedAccount() {
        player.setStatus(AccountStatus.LOCKED);player.setLockedUntil(LocalDateTime.now().minusMinutes(1));player.setFailedLoginCount(5);
        owner.setStatus(AccountStatus.LOCKED);owner.setLockedUntil(null);em.flush();maintenance.unlockExpired(LocalDateTime.now());
        assertThat(player.getStatus()).isEqualTo(AccountStatus.ACTIVE);assertThat(owner.getStatus()).isEqualTo(AccountStatus.LOCKED);
    }
    @Test void registrationRejectsAnOwnersPhoneBeforeSendingAnyOtp() throws Exception {
        String username="p"+UUID.randomUUID().toString().replace("-","").substring(0,12);
        mvc.perform(post("/api/auth/register").contentType("application/json").content(json.writeValueAsString(Map.of(
                "email",username+"@example.com","username",username,"phone",owner.getPhone(),"fullName","Test Player","password","Original123"))))
                .andExpect(status().isBadRequest());
        assertThat(accounts.findByUsername(username)).isEmpty();
    }
    @Test void courtCancelledSessionReturnsPackageVoucherUsageOnlyOnce() throws Exception {
        Long id=createPackage();
        var proof=new MockMultipartFile("proof","proof.png","image/png",new byte[]{1,2});
        var sent=mvc.perform(multipart("/api/booking-packages/"+id+"/payments").file(proof).header("Authorization",token(player))).andExpect(status().isCreated()).andReturn();
        Long payment=json.readTree(sent.getResponse().getContentAsString()).at("/data/id").asLong();
        mvc.perform(post("/api/staff/payments/"+payment+"/confirm").header("Authorization",token(owner)).header("X-Location-Id",location.getId())).andExpect(status().isOk());
        var sessions=em.createQuery("select b from Booking b where b.packageId=:p order by b.id",Booking.class).setParameter("p",id).getResultList();
        for(Booking session:sessions) {
            var affected=mvc.perform(post("/api/owner/bookings/"+session.getId()+"/cancel").header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                    .contentType("application/json").content("{\"cause\":\"OWNER_CANCELLED\",\"reason\":\"Sân phải hủy lịch\"}")).andExpect(status().isOk()).andReturn();
            Long affectedId=json.readTree(affected.getResponse().getContentAsString()).at("/data/id").asLong();
            mvc.perform(post("/api/affected-bookings/"+affectedId+"/submit-choice").header("Authorization",token(player))
                    .contentType("application/json").content("{\"choice\":\"REFUND\"}")).andExpect(status().isOk());
            assertThat(voucher.getUsedCount()).isZero();assertThat(voucher.getBudgetUsed()).isEqualByComparingTo("0");
        }
        assertThat(em.createQuery("select u.status from VoucherUsage u where u.packageId=:p",VoucherUsageStatus.class).setParameter("p",id).getSingleResult()).isEqualTo(VoucherUsageStatus.RETURNED);
    }
    @Test void complaintRefundRevokesOriginalReceiptPointsAndKeepsThePaymentDate() throws Exception {
        location.setPointEarningRate(10000);
        Booking b=Booking.builder().bookingCode("S"+UUID.randomUUID().toString().substring(0,12)).bookingType(BookingType.SINGLE)
                .locationId(location.getId()).courtId(court.getId()).playerId(player.getId()).playDate(LocalDate.now().plusDays(2))
                .startMinute(600).endMinute(660).listAmount(new BigDecimal("15000")).finalAmount(new BigDecimal("15000")).status(BookingStatus.CONFIRMED).build();em.persist(b);em.flush();
        var base=com.sep490.bms.entity.payment.Payment.builder().locationId(location.getId()).bookingId(b.getId()).amountDue(new BigDecimal("15000"))
                .receivedAmount(new BigDecimal("15000")).status(PaymentStatus.CONFIRMED).confirmedAt(LocalDateTime.now().minusDays(1)).confirmedBy(owner.getId()).build();em.persist(base);em.flush();points.accrueForConfirmedPayment(base.getId());
        var change=com.sep490.bms.entity.reschedule.RescheduleRequest.builder().bookingId(b.getId()).newCourtId(court.getId()).newDate(b.getPlayDate().plusDays(1))
                .newStartMinute(600).newEndMinute(660).oldListAmount(b.getListAmount()).newListAmount(new BigDecimal("30000")).extraAmount(new BigDecimal("15000")).status(RescheduleStatus.APPROVED).build();em.persist(change);em.flush();
        var extra=com.sep490.bms.entity.payment.Payment.builder().locationId(location.getId()).rescheduleRequestId(change.getId()).amountDue(new BigDecimal("15000"))
                .receivedAmount(new BigDecimal("15000")).status(PaymentStatus.CONFIRMED).confirmedAt(LocalDateTime.now()).confirmedBy(owner.getId()).build();em.persist(extra);em.flush();points.accrueForConfirmedPayment(extra.getId());
        assertThat(wallet().getPointBalance()).isEqualTo(12);
        var complaint=com.sep490.bms.entity.feedback.Complaint.builder().locationId(location.getId()).bookingId(b.getId()).playerId(player.getId())
                .createdBy(player.getId()).complaintType("COURT_SERVICE").content("Test refund").status(ComplaintStatus.PENDING_OWNER).build();em.persist(complaint);em.flush();
        mvc.perform(post("/api/owner/complaints/"+complaint.getId()+"/resolve").header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                .contentType("application/json").content("{\"result\":\"REFUND\"}")).andExpect(status().isOk());
        assertThat(wallet().getPointBalance()).isEqualTo(10);assertThat(wallet().getTotalPaid()).isEqualByComparingTo("0");
        var refund=em.createQuery("select r from RefundRequest r where r.complaintId=:c",com.sep490.bms.entity.reschedule.RefundRequest.class).setParameter("c",complaint.getId()).getSingleResult();
        assertThat(refund.getSuggestedAmount()).isEqualByComparingTo("30000");assertThat(refund.getOriginalPaymentDate()).isEqualTo(LocalDate.now().minusDays(1));
    }
}
