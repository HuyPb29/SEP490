package com.sep490.bms.integration;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sep490.bms.entity.account.*;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.*;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.security.JwtTokenProvider;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

/** MSG15, UC10 -> UC22: SQL thật, mọi dữ liệu test tự rollback. */
@SpringBootTest(properties={"bms.job.enabled=false", "app.booking-change.jobs-enabled=false", "bms.scheduler.match-sweep.enabled=false"})
@EnabledIfEnvironmentVariable(named="BMS_MAINTENANCE_INTEGRATION", matches="true")
@Transactional
class MaintenanceImpactApiTests {
    @Autowired WebApplicationContext context;
    @Autowired AccountRepository accounts;
    @Autowired LocationRepository locations;
    @Autowired CourtRepository courts;
    @Autowired MaintenanceRepository maintenance;
    @Autowired BookingRepository bookings;
    @Autowired PaymentRepository payments;
    @Autowired JwtTokenProvider jwt;
    @Autowired ObjectMapper json;
    @Autowired EntityManager em;
    MockMvc mvc;
    Account owner, player, staff;
    Location location;
    Court court, otherCourt;
    Maintenance request;
    LocalDate day;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = account(Role.OWNER); player = account(Role.PLAYER);
        location = locations.saveAndFlush(Location.builder().ownerId(owner.getId()).name("Fixture MSG15")
                .address("Fixture MSG15 rollback").latitude(BigDecimal.valueOf(21)).longitude(BigDecimal.valueOf(105))
                .contactPhone(owner.getPhone()).build());
        staff = account(Role.STAFF);
        court = courts.saveAndFlush(Court.builder().locationId(location.getId()).name("Sân MSG15").build());
        otherCourt = courts.saveAndFlush(Court.builder().locationId(location.getId()).name("Sân khác").build());
        day = LocalDate.now().plusDays(2);
        request = maintenance.saveAndFlush(Maintenance.builder().courtId(court.getId()).startAt(day.atTime(9,30))
                .endAt(day.atTime(10,30)).reason("Sửa đèn").requestedBy(staff.getId()).status(ApprovalStatus.PENDING).build());
    }
    private Account account(Role role) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0,10);
        return accounts.saveAndFlush(Account.builder().username("i"+suffix).email(suffix+"@example.com")
                .phone("0"+String.format("%09d",Math.floorMod(UUID.randomUUID().getMostSignificantBits(),1_000_000_000L)))
                .passwordHash("unused").fullName("Kiểm thử MSG15").role(role)
                .locationId(role == Role.STAFF ? location.getId() : null).status(AccountStatus.ACTIVE).build());
    }
    private Booking booking(Court target, int start, int end, BookingStatus status) {
        Booking b = bookings.saveAndFlush(Booking.builder().bookingCode("I"+UUID.randomUUID().toString().substring(0,15))
                .bookingType(BookingType.SINGLE).locationId(location.getId()).courtId(target.getId()).playerId(player.getId())
                .playDate(day).startMinute(start).endMinute(end).listAmount(new BigDecimal("100000"))
                .finalAmount(new BigDecimal("100000")).status(status).build());
        if (status == BookingStatus.CONFIRMED) payments.saveAndFlush(Payment.builder().locationId(location.getId())
                .bookingId(b.getId()).amountDue(b.getFinalAmount()).receivedAmount(b.getFinalAmount())
                .status(PaymentStatus.CONFIRMED).confirmedBy(owner.getId()).confirmedAt(LocalDateTime.now()).build());
        return b;
    }
    private String token(Account a) { return "Bearer "+jwt.generateToken(a); }
    private String path() { return "/api/owner/maintenance-requests/"+request.getId(); }
    private JsonNode preview() throws Exception {
        var r = mvc.perform(get(path()+"/impact").header("Authorization",token(owner)).header("X-Location-Id",location.getId()))
                .andExpect(status().isOk()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("data");
    }
    private String confirmation(JsonNode impact) throws Exception {
        List<Map<String,Object>> references = new ArrayList<>();
        for (var b : impact.get("bookings")) references.add(Map.of("id",b.get("id").asLong(),"version",b.get("version").asInt()));
        return json.writeValueAsString(Map.of("expectedBookings",references));
    }
    private ResultActions approve(String body) throws Exception {
        return mvc.perform(post(path()+"/approve").header("Authorization",token(owner)).header("X-Location-Id",location.getId())
                .contentType("application/json").content(body));
    }
    private long affectedCount() {
        return em.createQuery("select count(a) from AffectedBooking a where a.maintenanceId=:id",Long.class)
                .setParameter("id",request.getId()).getSingleResult();
    }
    @Test void previewIncludesOnlyConfirmedFutureBookingsThatActuallyIntersect() throws Exception {
        Booking first = booking(court,540,600,BookingStatus.CONFIRMED);
        Booking second = booking(court,600,660,BookingStatus.CONFIRMED);
        booking(court,510,570,BookingStatus.CONFIRMED); // Chỉ chạm đầu khung bảo trì.
        booking(court,630,660,BookingStatus.CONFIRMED); // Chỉ chạm cuối khung bảo trì.
        booking(court,570,630,BookingStatus.HOLDING);
        booking(otherCourt,570,630,BookingStatus.CONFIRMED);
        JsonNode impact = preview();
        assertThat(impact.get("affectedCount").asInt()).isEqualTo(2);
        assertThat(impact.get("bookings").get(0).get("id").asLong()).isEqualTo(first.getId());
        assertThat(impact.get("bookings").get(1).get("id").asLong()).isEqualTo(second.getId());
        assertThat(affectedCount()).isZero();
        assertThat(maintenance.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(ApprovalStatus.PENDING);
    }
    @Test void approvalWithoutAcknowledgingAffectedBookingsIsBlocked() throws Exception {
        booking(court,540,600,BookingStatus.CONFIRMED);
        approve("{}").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("MSG15")));
        assertThat(affectedCount()).isZero();
        assertThat(maintenance.findById(request.getId()).orElseThrow().getStatus()).isEqualTo(ApprovalStatus.PENDING);
    }
    @Test void acknowledgedApprovalCreatesAffectedRecordsAndKeepsOnlineBookingsConfirmed() throws Exception {
        Booking first = booking(court,540,600,BookingStatus.CONFIRMED);
        Booking second = booking(court,600,660,BookingStatus.CONFIRMED);
        approve(confirmation(preview())).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
        em.flush();
        assertThat(affectedCount()).isEqualTo(2);
        assertThat(bookings.findById(first.getId()).orElseThrow().getStatus()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(bookings.findById(second.getId()).orElseThrow().getStatus()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(em.createQuery("select count(n) from Notification n where n.recipientId=:player and n.type='BOOKING_AFFECTED'",Long.class)
                .setParameter("player",player.getId()).getSingleResult()).isEqualTo(2);
    }
    @Test void bookingChangeWithSameCountStillRequiresNewConfirmation() throws Exception {
        Booking b = booking(court,540,600,BookingStatus.CONFIRMED);
        JsonNode old = preview();
        b.setStartMinute(570); bookings.saveAndFlush(b);
        approve(confirmation(old)).andExpect(status().isConflict());
        assertThat(affectedCount()).isZero();
    }
    @Test void newBookingAfterPreviewRequiresNewConfirmation() throws Exception {
        booking(court,540,600,BookingStatus.CONFIRMED);
        JsonNode old = preview();
        booking(court,600,660,BookingStatus.CONFIRMED);
        approve(confirmation(old)).andExpect(status().isConflict());
        assertThat(affectedCount()).isZero();
    }
    @Test void noImpactCanBeApprovedDirectly() throws Exception {
        assertThat(preview().get("affectedCount").asInt()).isZero();
        approve("{}").andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
    }
    @Test void previewIsRestrictedToOwnerOfSelectedVenue() throws Exception {
        Account otherOwner = account(Role.OWNER);
        mvc.perform(get(path()+"/impact").header("Authorization",token(otherOwner)).header("X-Location-Id",location.getId()))
                .andExpect(status().isForbidden());
        mvc.perform(get(path()+"/impact").header("Authorization",token(staff))).andExpect(status().isForbidden());
    }
}
