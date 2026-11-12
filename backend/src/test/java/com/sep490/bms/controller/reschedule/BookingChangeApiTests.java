package com.sep490.bms.controller.reschedule;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.dto.request.*;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.booking.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.reschedule.*;
import com.sep490.bms.entity.team.*;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.security.*;
import com.sep490.bms.service.reschedule.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

/**
 * Kiểm thử tích hợp đổi lịch, xác nhận phụ thu, hủy booking, xử lý booking bị ảnh hưởng và hoàn tiền.
 */
@SpringBootTest(properties="app.booking-change.jobs-enabled=false")
class BookingChangeApiTests {
    @Test void extraPaymentSupportsResubmissionAndPlayerCanReadItsProof() throws Exception {
        Long id=create(660);
        mvc.perform(post("/api/reschedule-requests/" + id + "/payments").header("Authorization", token(player)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false));
        assertThat(jdbc.queryForObject("select count(*) from payment where reschedule_request_id=?", Integer.class, id)).isZero();
        mvc.perform(paymentProof(id)).andExpect(status().isOk());
        Long payment=jdbc.queryForObject("select id from payment where reschedule_request_id=?",Long.class,id);
        mvc.perform(post("/api/staff/reschedule-payments/"+payment+"/request-resubmission").header("Authorization",token(owner))
                .header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Transfer delayed\",\"playerAtFault\":false,\"receivedAmount\":5000}")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select status from payment where id=?",String.class,payment)).isEqualTo("RESUBMIT_REQUESTED");
        assertThat(bookingStatus()).isEqualTo("CONFIRMED");
        String paymentPath = "/api/reschedule-requests/" + id + "/payment";
        mvc.perform(get(paymentPath).header("Authorization", token(player)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(payment))
                .andExpect(jsonPath("$.data.status").value("RESUBMIT_REQUESTED"))
                .andExpect(jsonPath("$.data.resubmitReason").value("Transfer delayed"))
                .andExpect(jsonPath("$.data.receivedAmount").value(5000))
                .andExpect(jsonPath("$.data.remainingAmount").value(15000));
        mvc.perform(get("/api/reschedule-requests/" + id + "/payment-instructions")
                .header("Authorization", token(player))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.amountDue").value(15000));
        mvc.perform(get(paymentPath).header("Authorization", token(other))).andExpect(status().isForbidden());
        var proof=new org.springframework.mock.web.MockMultipartFile("proof","receipt.png","image/png",new byte[]{1,2});
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/reschedule-payments/"+payment+"/resubmit")
                .file(proof).header("Authorization",token(player))).andExpect(status().isOk());
        Long proofId=jdbc.queryForObject("select max(id) from payment_proof where payment_id=?",Long.class,payment);
        String image="/api/payments/"+payment+"/proofs/"+proofId+"/image";
        mvc.perform(get(image).header("Authorization",token(player))).andExpect(status().isOk());
        mvc.perform(get(image).header("Authorization",token(other))).andExpect(status().isForbidden());
        mvc.perform(post("/api/staff/reschedule-payments/"+payment+"/confirm").header("Authorization",token(owner)).header("X-Location-Id",location.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
    }
    @Test
    void onlyBookingPlayerCanReadRescheduleDeadline() throws Exception {
        String path = "/api/bookings/" + booking.getId() + "/reschedule-deadline";
        mvc.perform(get(path).header("Authorization", token(player)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").isString());
        mvc.perform(get(path).header("Authorization", token(other))).andExpect(status().isForbidden());
    }

    @Test
    void ownerListsCancellableBookingsForSelectedVenueAndDay() throws Exception {
        String path = "/api/owner/bookings/cancellable";
        mvc.perform(get(path).param("playDate", booking.getPlayDate().toString())
                .header("Authorization", token(owner)).header("X-Location-Id", location.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(booking.getId()));
        mvc.perform(get(path).param("playDate", booking.getPlayDate().plusDays(1).toString())
                .header("Authorization", token(owner)).header("X-Location-Id", location.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(get(path).param("playDate", booking.getPlayDate().toString())
                .header("Authorization", token(player))).andExpect(status().isForbidden());
    }

    @Autowired WebApplicationContext context;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @Autowired AccountRepository accounts;
    @Autowired LocationRepository locations;
    @Autowired JwtTokenProvider jwt;
    @Autowired ObjectMapper json;
    @Autowired RescheduleService reschedules;
    @Autowired CancellationService cancellations;
    MockMvc mvc; TransactionTemplate tx;
    Account owner,player,other; Location location; Long court; Booking booking;
    final List<Long> accountIds=new ArrayList<>();

    @BeforeEach void setup() throws Exception {
        try(var c=Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
            if(!"BMS_Test".equalsIgnoreCase(c.getCatalog())) throw new IllegalStateException("Fixtures require BMS_Test");
        }
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build(); tx=new TransactionTemplate(manager);
        owner=account(Role.OWNER);player=account(Role.PLAYER);other=account(Role.PLAYER);
        location=locations.saveAndFlush(Location.builder().ownerId(owner.getId()).name("Booking change test").address("Test")
                .contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE).build());
        tx.executeWithoutResult(s->{
            Court c=Court.builder().locationId(location.getId()).name("Test court").active(true).build();em.persist(c);em.flush();court=c.getId();
            for(int day=1;day<=7;day++) em.persist(OpeningHour.builder().locationId(location.getId()).dayOfWeek(day).openMinute(0).closeMinute(1440).build());
            em.persist(PriceRule.builder().courtId(court).startMinute(0).endMinute(1440).pricePerSlot(new BigDecimal("60000"))
                    .applyDays("1111111").validFrom(LocalDate.now()).validTo(LocalDate.now().plusMonths(4)).build());
            booking=Booking.builder().bookingCode("C"+UUID.randomUUID().toString().substring(0,12)).bookingType(BookingType.SINGLE)
                    .locationId(location.getId()).courtId(court).playerId(player.getId()).playDate(LocalDate.now().plusDays(2)).startMinute(600).endMinute(660)
                    .listAmount(new BigDecimal("100000")).finalAmount(new BigDecimal("90000")).voucherDiscount(new BigDecimal("10000"))
                    .status(BookingStatus.CONFIRMED).createdAt(LocalDateTime.now().minusDays(1)).build();em.persist(booking);em.flush();
            for(int m=600;m<660;m+=30) em.persist(BookingSlot.builder().bookingId(booking.getId()).courtId(court).slotDate(booking.getPlayDate()).slotStartMinute(m).price(new BigDecimal("50000")).build());
            em.persist(Payment.builder().locationId(location.getId()).bookingId(booking.getId()).amountDue(booking.getFinalAmount()).receivedAmount(booking.getFinalAmount())
                    .status(PaymentStatus.CONFIRMED).confirmedBy(owner.getId()).confirmedAt(LocalDateTime.now().minusHours(1)).build());
        });
    }
    Account account(Role role) {
        String suffix=UUID.randomUUID().toString().replace("-","").substring(0,12);
        Account a=accounts.saveAndFlush(Account.builder().username("c"+suffix).email(suffix+"@example.com")
                .phone("0"+String.format("%09d",Math.floorMod(UUID.randomUUID().getMostSignificantBits(),1000000000L)))
                .passwordHash("test-unused").fullName("Booking Test").role(role).status(AccountStatus.ACTIVE).build());accountIds.add(a.getId());return a;
    }
    String token(Account a) {return "Bearer "+jwt.generateToken(a);}
    String slot(int end) throws Exception { return json.writeValueAsString(new ReschedulePreviewRequest(court,LocalDate.now().plusDays(3),600,end)); }
    Long create(int end) throws Exception {
        var r=mvc.perform(post("/api/bookings/"+booking.getId()+"/reschedule-requests").header("Authorization",token(player))
                .contentType(MediaType.APPLICATION_JSON).content(slot(end))).andExpect(status().isCreated()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).at("/data/id").asLong();
    }
    private org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder paymentProof(Long id) {
        var proof = new org.springframework.mock.web.MockMultipartFile("proof", "receipt.png", "image/png", new byte[]{1, 2});
        var request = multipart("/api/reschedule-requests/" + id + "/payments").file(proof);
        request.header("Authorization", token(player));
        return request;
    }

    Long mark() throws Exception {
        var r=mvc.perform(post("/api/owner/bookings/"+booking.getId()+"/cancel").header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"cause\":\"OWNER_CANCELLED\",\"reason\":\"Facility unavailable\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("PENDING")).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).at("/data/id").asLong();
    }
    void choice(Long id,String value) throws Exception {
        mvc.perform(post("/api/affected-bookings/"+id+"/submit-choice").header("Authorization",token(player))
                .contentType(MediaType.APPLICATION_JSON).content("{\"choice\":\""+value+"\"}")).andExpect(status().isOk());
    }
    int active(LocalDate date) {return jdbc.queryForObject("select count(*) from booking_slot where booking_id=? and is_active=1 and slot_date=?",Integer.class,booking.getId(),java.sql.Date.valueOf(date));}
    String bookingStatus() {return jdbc.queryForObject("select status from booking where id=?",String.class,booking.getId());}

    @AfterEach void cleanup() {
        if(location!=null) {
            Long id=location.getId();
            jdbc.update("delete from notification where recipient_id in (?,?,?)",owner.getId(),player.getId(),other.getId());
            jdbc.update("delete from refund_request where location_id=?",id);
            jdbc.update("delete from match_join_request where match_id in (select m.id from [match] m join booking b on b.id=m.booking_id where b.location_id=?)",id);
            jdbc.update("delete from [match] where booking_id in (select id from booking where location_id=?)",id);
            jdbc.update("delete from loyalty_accrual where balance_id in (select id from player_location_balance where location_id=?)",id);
            jdbc.update("delete from point_transaction where balance_id in (select id from player_location_balance where location_id=?)",id);
            jdbc.update("delete from player_location_balance where location_id=?",id);
            jdbc.update("delete from payment_proof where payment_id in (select id from payment where location_id=?)",id);
            jdbc.update("delete from payment where location_id=?",id);
            jdbc.update("delete from booking_slot where booking_id in (select id from booking where location_id=?)",id);
            jdbc.update("delete from affected_booking where booking_id in (select id from booking where location_id=?)",id);
            jdbc.update("delete from reschedule_request where booking_id in (select id from booking where location_id=?)",id);
            jdbc.update("delete from booking where location_id=?",id);
            jdbc.update("delete from booking_package where location_id=?",id);
            jdbc.update("delete from maintenance where court_id in (select id from court where location_id=?)",id);
            jdbc.update("delete from price_rule where court_id in (select id from court where location_id=?)",id);
            jdbc.update("delete from opening_hour where location_id=?",id);
            jdbc.update("delete from court where location_id=?",id);locations.deleteById(id);
        }
        for(Long id:accountIds) accounts.deleteById(id);accountIds.clear();
    }
    @Test void previewUsesStoredListPriceAndDoesNotHoldSlots() throws Exception {
        mvc.perform(post("/api/bookings/"+booking.getId()+"/reschedule-requests/preview").header("Authorization",token(player))
                .contentType(MediaType.APPLICATION_JSON).content(slot(660))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.oldListAmount").value(100000)).andExpect(jsonPath("$.data.newListAmount").value(120000))
                .andExpect(jsonPath("$.data.amountPaid").value(90000)).andExpect(jsonPath("$.data.extraAmount").value(20000));
        assertThat(active(LocalDate.now().plusDays(3))).isZero();
    }
    @Test void cheaperMovePreservesFinancialSnapshotAndCode() throws Exception {
        Long id=create(630);
        mvc.perform(get("/api/reschedule-requests/"+id).header("Authorization",token(player))).andExpect(jsonPath("$.data.status").value("APPROVED"));
        assertThat(active(booking.getPlayDate())).isZero();assertThat(active(LocalDate.now().plusDays(3))).isEqualTo(1);
        assertThat(jdbc.queryForObject("select final_amount from booking where id=?",BigDecimal.class,booking.getId())).isEqualByComparingTo("90000");
        assertThat(jdbc.queryForObject("select booking_code from booking where id=?",String.class,booking.getId())).isEqualTo(booking.getBookingCode());
    }
    @Test void extraPaymentHoldsBothThenConfirmsAndEarnsPoints() throws Exception {
        Long id=create(660);assertThat(active(booking.getPlayDate())).isEqualTo(2);assertThat(active(LocalDate.now().plusDays(3))).isEqualTo(2);
        mvc.perform(paymentProof(id)).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("AWAITING_CONFIRMATION"));
        Long pay=jdbc.queryForObject("select id from payment where reschedule_request_id=?",Long.class,id);
        // UC18–19 retain Minh's booking contract; UC21 uses its own routes and payment type.
        Long originalPay=jdbc.queryForObject("select id from payment where booking_id=?",Long.class,booking.getId());
        mvc.perform(get("/api/payments/"+originalPay).header("Authorization",token(player)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(originalPay));
        mvc.perform(get("/api/payments/"+pay).header("Authorization",token(player))).andExpect(status().isNotFound());
        mvc.perform(get("/api/reschedule-payments/"+originalPay).header("Authorization",token(player))).andExpect(status().isNotFound());
        mvc.perform(get("/api/reschedule-payments/"+pay).header("Authorization",token(player)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.payment.id").value(pay));
        mvc.perform(get("/api/staff/reschedule-payments?status=AWAITING_CONFIRMATION").header("Authorization",token(owner)).header("X-Location-Id",location.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(pay));
        mvc.perform(get("/api/staff/reschedule-payments/"+pay).header("Authorization",token(owner)).header("X-Location-Id",location.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.payment.amountDue").value(20000));
        mvc.perform(get("/api/reschedule-payments/"+pay).header("Authorization",token(other))).andExpect(status().isForbidden());
        mvc.perform(post("/api/staff/reschedule-payments/"+pay+"/confirm").header("Authorization",token(owner)).header("X-Location-Id",location.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
        assertThat(active(booking.getPlayDate())).isZero();
        assertThat(jdbc.queryForObject("select point_balance from player_location_balance where location_id=?",Integer.class,location.getId())).isEqualTo(2);
        mvc.perform(post("/api/staff/reschedule-payments/"+pay+"/confirm").header("Authorization",token(owner)).header("X-Location-Id",location.getId())).andExpect(status().isConflict());
    }
    @Test void rejectionReleasesOnlyNewSlots() throws Exception {
        Long id=create(660);mvc.perform(paymentProof(id)).andExpect(status().isOk());
        Long pay=jdbc.queryForObject("select id from payment where reschedule_request_id=?",Long.class,id);
        mvc.perform(post("/api/staff/reschedule-payments/"+pay+"/reject").header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Money not received\"}")).andExpect(status().isOk());
        assertThat(active(booking.getPlayDate())).isEqualTo(2);assertThat(active(LocalDate.now().plusDays(3))).isZero();
        assertThat(bookingStatus()).isEqualTo("CONFIRMED");
    }
    @Test void unpaidHoldExpiresAndDoesNotConsumeSuccessfulChange() throws Exception {
        Long id=create(660);jdbc.update("update reschedule_request set hold_expires_at=? where id=?",LocalDateTime.now().minusMinutes(1),id);
        reschedules.expireRequest(id);reschedules.expireRequest(id);
        assertThat(active(booking.getPlayDate())).isEqualTo(2);assertThat(active(LocalDate.now().plusDays(3))).isZero();
        assertThat(jdbc.queryForObject("select reschedule_count from booking where id=?",Integer.class,booking.getId())).isZero();
    }
    @Test void approvalDeadlineExpiresSubmittedPayment() throws Exception {
        Long id=create(660);mvc.perform(paymentProof(id)).andExpect(status().isOk());
        jdbc.update("update reschedule_request set approve_deadline=? where id=?",LocalDateTime.now().minusMinutes(1),id);reschedules.expireRequest(id);
        assertThat(jdbc.queryForObject("select status from payment where reschedule_request_id=?",String.class,id)).isEqualTo("REJECTED");
        assertThat(active(booking.getPlayDate())).isEqualTo(2);
    }
    @Test void playerCancelKeepsDiscountsAndExpiresMatch() throws Exception {
        tx.executeWithoutResult(s->{Match m=Match.builder().bookingId(booking.getId()).currentPlayers(1).neededPlayers(1).build();em.persist(m);em.flush();
            em.persist(MatchJoinRequest.builder().matchId(m.getId()).playerId(other.getId()).phoneConsent(true).build());});
        mvc.perform(post("/api/bookings/"+booking.getId()+"/cancel").header("Authorization",token(player))).andExpect(status().isOk());
        assertThat(bookingStatus()).isEqualTo("CANCELLED_BY_PLAYER");assertThat(active(booking.getPlayDate())).isZero();
        assertThat(jdbc.queryForObject("select status from [match] where booking_id=?",String.class,booking.getId())).isEqualTo("EXPIRED");
        assertThat(jdbc.queryForObject("select count(*) from refund_request where booking_id=?",Integer.class,booking.getId())).isZero();
        assertThat(jdbc.queryForObject("select voucher_discount from booking where id=?",BigDecimal.class,booking.getId())).isEqualByComparingTo("10000");
    }
    @Test void affectedRefundAndManualRecordAreAtomicAndScoped() throws Exception {
        Long id=mark();assertThat(bookingStatus()).isEqualTo("CONFIRMED");choice(id,"REFUND");
        assertThat(bookingStatus()).isEqualTo("CANCELLED_BY_FACILITY");
        Long refund=jdbc.queryForObject("select id from refund_request where affected_booking_id=?",Long.class,id);
        String url="/api/owner/refunds/"+refund+"/record";
        mvc.perform(post(url).header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":90001,\"refundDate\":\""+LocalDate.now()+"\",\"reason\":\"Too much\"}")).andExpect(status().isBadRequest());
        mvc.perform(post(url).header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":80000,\"refundDate\":\""+LocalDate.now()+"\"}")).andExpect(status().isBadRequest());
        String body="{\"amount\":90000,\"refundDate\":\""+LocalDate.now()+"\"}";
        mvc.perform(post(url).header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("REFUNDED"));
        mvc.perform(post(url).header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        mvc.perform(get("/api/owner/refunds?status=REFUNDED").header("Authorization",token(owner)).header("X-Location-Id",location.getId())).andExpect(jsonPath("$.data.length()").value(1));
    }
    @Test void compensationIsIdempotentAndIncludesExtraPayments() throws Exception {
        Long request=create(660);
        mvc.perform(paymentProof(request)).andExpect(status().isOk());
        Long payment=jdbc.queryForObject("select id from payment where reschedule_request_id=?",Long.class,request);
        mvc.perform(post("/api/staff/reschedule-payments/"+payment+"/confirm").header("Authorization",token(owner)).header("X-Location-Id",location.getId())).andExpect(status().isOk());
        Long id=mark();choice(id,"POINTS");
        assertThat(jdbc.queryForObject("select compensation_points from affected_booking where id=?",Integer.class,id)).isEqualTo(220);
        mvc.perform(post("/api/affected-bookings/"+id+"/submit-choice").header("Authorization",token(player)).contentType(MediaType.APPLICATION_JSON).content("{\"choice\":\"POINTS\"}")).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select point_balance from player_location_balance where location_id=?",Integer.class,location.getId())).isEqualTo(222);
    }
    @Test void defaultCompensationAtStartCannotBeConvertedToRefund() throws Exception {
        Long id=mark();jdbc.update("update booking set play_date=?, start_minute=0,end_minute=30 where id=?",java.sql.Date.valueOf(LocalDate.now()),booking.getId());
        cancellations.defaultChoice(id);cancellations.defaultChoice(id);
        assertThat(jdbc.queryForObject("select is_default_choice from affected_booking where id=?",Boolean.class,id)).isTrue();
        mvc.perform(post("/api/affected-bookings/"+id+"/submit-choice").header("Authorization",token(player)).contentType(MediaType.APPLICATION_JSON).content("{\"choice\":\"REFUND\"}")).andExpect(status().isConflict());
    }
    @Test void freeMoveBypassesCountWithoutChargingMore() throws Exception {
        Long id=mark();jdbc.update("update booking set reschedule_count=1 where id=?",booking.getId());
        mvc.perform(post("/api/affected-bookings/"+id+"/submit-choice").header("Authorization",token(player)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"choice\":\"RESCHEDULE\",\"slot\":"+slot(660)+"}")).andExpect(status().isOk());
        assertThat(bookingStatus()).isEqualTo("CONFIRMED");assertThat(active(booking.getPlayDate())).isZero();
        assertThat(jdbc.queryForObject("select extra_amount from reschedule_request where booking_id=?",BigDecimal.class,booking.getId())).isEqualByComparingTo("0");
        assertThat(jdbc.queryForObject("select reschedule_count from booking where id=?",Integer.class,booking.getId())).isEqualTo(1);
    }
    @Test void cutoffAndMaxCountAreEnforced() throws Exception {
        tx.executeWithoutResult(s->{Booking b=em.find(Booking.class,booking.getId());b.setPlayDate(LocalDate.now().plusDays(1));b.setCreatedAt(LocalDateTime.now().minusDays(10));
            assertThat(reschedules.deadline(b)).isEqualTo(b.getPlayDate().atTime(4,0));});
        jdbc.update("update booking set reschedule_count=1 where id=?",booking.getId());
        mvc.perform(post("/api/bookings/"+booking.getId()+"/reschedule-requests/preview").header("Authorization",token(player)).contentType(MediaType.APPLICATION_JSON).content(slot(660))).andExpect(status().isConflict());
    }
    @Test void unavailableOutsideHorizonAndInvalidSlotsAreRejected() throws Exception {
        String base="/api/bookings/"+booking.getId()+"/reschedule-requests";
        mvc.perform(post(base).header("Authorization",token(player)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new ReschedulePreviewRequest(court,booking.getPlayDate(),600,660)))).andExpect(status().isConflict());
        mvc.perform(post(base).header("Authorization",token(player)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new ReschedulePreviewRequest(court,LocalDate.now().plusDays(31),600,660)))).andExpect(status().isBadRequest());
        mvc.perform(post(base).header("Authorization",token(player)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new ReschedulePreviewRequest(court,LocalDate.now().plusDays(3),601,660)))).andExpect(status().isBadRequest());
    }
    @Test void authenticationOwnershipAndChoiceValidation() throws Exception {
        String url="/api/bookings/"+booking.getId()+"/reschedule-requests";
        mvc.perform(get(url)).andExpect(status().isUnauthorized());
        mvc.perform(get(url).header("Authorization",token(owner))).andExpect(status().isForbidden());
        mvc.perform(get(url).header("Authorization",token(other))).andExpect(status().isForbidden());
        Long id=mark();mvc.perform(post("/api/affected-bookings/"+id+"/submit-choice").header("Authorization",token(player))
                .contentType(MediaType.APPLICATION_JSON).content("{\"choice\":\"RESCHEDULE\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/owner/refunds").header("Authorization",token(player)).header("X-Location-Id",location.getId())).andExpect(status().isForbidden());
    }
    @Test void concurrentRescheduleCreatesOnlyOnePendingHold() throws Exception {
        String body=slot(660);String auth=token(player);var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {
            Callable<Integer> call=()->{gate.await();return mvc.perform(post("/api/bookings/"+booking.getId()+"/reschedule-requests").header("Authorization",auth)
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getStatus();};
            var first=pool.submit(call);var second=pool.submit(call);gate.countDown();
            assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);
            assertThat(active(LocalDate.now().plusDays(3))).isEqualTo(2);
        } finally {pool.shutdownNow();}
    }
    @Test void maintenanceHookMarksOnlyIntersectingBookings() {
        tx.executeWithoutResult(s->{Maintenance m=Maintenance.builder().courtId(court).startAt(booking.getPlayDate().atTime(10,30))
                .endAt(booking.getPlayDate().atTime(12,0)).reason("Test maintenance").status(ApprovalStatus.APPROVED).requestedBy(owner.getId()).build();em.persist(m);em.flush();
            cancellations.maintenanceApproved(m,owner.getId());cancellations.maintenanceApproved(m,owner.getId());});
        assertThat(jdbc.queryForObject("select count(*) from affected_booking where booking_id=?",Integer.class,booking.getId())).isEqualTo(1);
        assertThat(bookingStatus()).isEqualTo("CONFIRMED");
    }
    @Test void confirmationRejectsTargetThatBecameUnavailable() throws Exception {
        Long id=create(660);mvc.perform(paymentProof(id)).andExpect(status().isOk());
        tx.executeWithoutResult(s->em.persist(Maintenance.builder().courtId(court).startAt(LocalDate.now().plusDays(3).atTime(10,0))
                .endAt(LocalDate.now().plusDays(3).atTime(11,0)).reason("New maintenance").status(ApprovalStatus.APPROVED).requestedBy(owner.getId()).build()));
        Long payment=jdbc.queryForObject("select id from payment where reschedule_request_id=?",Long.class,id);
        mvc.perform(post("/api/staff/reschedule-payments/"+payment+"/confirm").header("Authorization",token(owner)).header("X-Location-Id",location.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("REJECTED"));
        assertThat(active(booking.getPlayDate())).isEqualTo(2);assertThat(active(LocalDate.now().plusDays(3))).isZero();
    }
    @Test void packageSessionMustStayWithinPackagePeriod() throws Exception {
        tx.executeWithoutResult(s->{BookingPackage pkg=BookingPackage.builder().locationId(location.getId()).playerId(player.getId()).packageType(PackageType.CUSTOM)
                .startDate(LocalDate.now()).endDate(LocalDate.now().plusMonths(2)).listAmount(new BigDecimal("200000")).finalAmount(new BigDecimal("180000"))
                .status(BookingStatus.CONFIRMED).build();em.persist(pkg);em.flush();
            Booking b=em.find(Booking.class,booking.getId());b.setBookingType(BookingType.SESSION);b.setPackageId(pkg.getId());
            Payment p=em.createQuery("select p from Payment p where p.bookingId=:b",Payment.class).setParameter("b",b.getId()).getSingleResult();
            p.setBookingId(null);p.setPackageId(pkg.getId());p.setAmountDue(pkg.getFinalAmount());p.setReceivedAmount(pkg.getFinalAmount());});
        String url="/api/bookings/"+booking.getId()+"/reschedule-requests/preview";
        mvc.perform(post(url).header("Authorization",token(player)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new ReschedulePreviewRequest(court,LocalDate.now().plusDays(40),600,660)))).andExpect(status().isOk());
        mvc.perform(post(url).header("Authorization",token(player)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new ReschedulePreviewRequest(court,LocalDate.now().plusMonths(3),600,660)))).andExpect(status().isBadRequest());
    }
    @Test void courtAndHoursApiChangesMarkAffectedBookings() throws Exception {
        mvc.perform(put("/api/owner/locations/"+location.getId()+"/opening-hours").header("Authorization",token(owner))
                .contentType(MediaType.APPLICATION_JSON).content("{\"hours\":[{\"dayOfWeek\":1,\"openMinute\":1200,\"closeMinute\":1260}]}")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select cause from affected_booking where booking_id=?",String.class,booking.getId())).isEqualTo("HOURS_CHANGED");
        mvc.perform(patch("/api/owner/courts/"+court).header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"isActive\":false}")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from affected_booking where booking_id=?",Integer.class,booking.getId())).isEqualTo(1);
    }
    @Test void concurrentRefundRecordHasOneWinnerAndRevenueUsesRefundDate() throws Exception {
        Long affected=mark();choice(affected,"REFUND");Long id=jdbc.queryForObject("select id from refund_request where affected_booking_id=?",Long.class,affected);
        String body="{\"amount\":90000,\"refundDate\":\""+LocalDate.now()+"\"}";String auth=token(owner);
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try {
            Callable<Integer> call=()->{gate.await();return mvc.perform(post("/api/owner/refunds/"+id+"/record").header("Authorization",auth).header("X-Location-Id",location.getId())
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getStatus();};
            var first=pool.submit(call);var second=pool.submit(call);gate.countDown();
            assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        } finally {pool.shutdownNow();}
        var reports=context.getBean(com.sep490.bms.repository.operation.OperationQueryRepository.class);
        assertThat(reports.sumRefunds(location.getId(),LocalDate.now(),LocalDate.now()).get(0).getAmount()).isEqualByComparingTo("90000");
        assertThat(reports.sumRefunds(location.getId(),LocalDate.now().minusDays(1),LocalDate.now().minusDays(1))).isEmpty();
    }
    @Test void cumulativeRefundsCannotExceedCollectedAmount() throws Exception {
        Long affected=mark();choice(affected,"REFUND");Long first=jdbc.queryForObject("select id from refund_request where affected_booking_id=?",Long.class,affected);
        String body="{\"amount\":80000,\"refundDate\":\""+LocalDate.now()+"\",\"reason\":\"Partial refund\"}";
        mvc.perform(post("/api/owner/refunds/"+first+"/record").header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        Long second=tx.execute(s->{RefundRequest r=RefundRequest.builder().locationId(location.getId()).bookingId(booking.getId()).affectedBookingId(affected)
                .suggestedAmount(new BigDecimal("20000")).originalPaymentDate(LocalDate.now()).build();em.persist(r);em.flush();return r.getId();});
        mvc.perform(post("/api/owner/refunds/"+second+"/record").header("Authorization",token(owner)).header("X-Location-Id",location.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":20000,\"refundDate\":\""+LocalDate.now()+"\"}")).andExpect(status().isBadRequest());
        Account outsider=account(Role.OWNER);
        mvc.perform(get("/api/owner/refunds/"+first).header("Authorization",token(outsider)).header("X-Location-Id",location.getId())).andExpect(status().isForbidden());
    }
}
