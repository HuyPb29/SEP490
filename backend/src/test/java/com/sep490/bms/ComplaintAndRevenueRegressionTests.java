package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

import com.sep490.bms.entity.*;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.feedback.Complaint;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.repository.*;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.feedback.ComplaintRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.operation.OperationQueryRepository;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.security.JwtTokenProvider;
import com.sep490.bms.service.EmailService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Committed SQL Server fixtures and real HTTP requests; never uses or recreates production data. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ComplaintAndRevenueRegressionTests {
    @LocalServerPort int port;
    @Autowired AccountRepository accounts;
    @Autowired LocationRepository locations;
    @Autowired CourtRepository courts;
    @Autowired BookingRepository bookings;
    @Autowired ComplaintRepository complaints;
    @Autowired PaymentRepository payments;
    @Autowired OperationQueryRepository reports;
    @Autowired JwtTokenProvider jwt;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @MockitoBean EmailService mail;

    final HttpClient client = HttpClient.newHttpClient();
    final List<Long> accountIds = new ArrayList<>();
    Account owner, player;
    Location location;
    Court court;
    Complaint complaint;
    String ownerToken;

    @BeforeEach void setup() throws Exception {
        try (var connection = Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
            if (!"BMS_Test".equalsIgnoreCase(connection.getCatalog())) {
                throw new IllegalStateException("Regression fixtures require BMS_Test");
            }
        }
        owner = account(Role.OWNER);
        player = account(Role.PLAYER);
        ownerToken = jwt.generateToken(owner);
        location = locations.saveAndFlush(Location.builder().ownerId(owner.getId()).name("Regression test")
                .address("Test").contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE).build());
        court = courts.saveAndFlush(Court.builder().locationId(location.getId()).name("Test court").active(true).build());
        Booking booking = booking();
        complaint = complaints.saveAndFlush(Complaint.builder().locationId(location.getId()).bookingId(booking.getId())
                .playerId(player.getId()).createdBy(player.getId()).complaintType("COURT_SERVICE")
                .content("Test complaint").status(ComplaintStatus.PENDING_OWNER).build());
    }

    Account account(Role role) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        Account result = accounts.saveAndFlush(Account.builder().username("r" + suffix).email(suffix + "@example.com")
                .phone("0" + String.format("%09d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 1000000000L)))
                .fullName("Regression Tester").passwordHash("test-only-unused-hash").role(role).status(AccountStatus.ACTIVE).build());
        accountIds.add(result.getId());
        return result;
    }

    Booking booking() {
        return bookings.saveAndFlush(Booking.builder().bookingCode("R" + UUID.randomUUID().toString().substring(0, 12))
                .bookingType(BookingType.SINGLE).locationId(location.getId()).courtId(court.getId()).playerId(player.getId())
                .playDate(LocalDate.now()).startMinute(600).endMinute(660).listAmount(new BigDecimal("200000"))
                .finalAmount(new BigDecimal("200000")).status(BookingStatus.COMPLETED).build());
    }

    @AfterEach void cleanup() {
        if (location != null) {
            Long id = location.getId();
            jdbc.update("DELETE FROM notification WHERE ref_type='COMPLAINT' AND ref_id IN (SELECT id FROM complaint WHERE location_id=?)", id);
            jdbc.update("DELETE FROM refund_request WHERE location_id=?", id);
            jdbc.update("DELETE FROM complaint WHERE location_id=?", id);
            jdbc.update("DELETE FROM payment WHERE location_id=?", id);
            jdbc.update("DELETE FROM booking WHERE location_id=?", id);
            jdbc.update("DELETE FROM court WHERE location_id=?", id);
            locations.deleteById(id);
        }
        for (Long id : accountIds) accounts.deleteById(id);
    }

    HttpResponse<String> decision(String action, String body) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/owner/complaints/"
                + complaint.getId() + "/" + action)).timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + ownerToken).header("X-Location-Id", location.getId().toString())
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    long refundCount() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM refund_request WHERE complaint_id=?", Long.class, complaint.getId());
    }

    @Test void simultaneousRefundApprovalsCreateExactlyOneRefund() throws Exception {
        List<Integer> statuses = race("resolve", "{\"result\":\"REFUND\"}");
        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        assertThat(refundCount()).isEqualTo(1);
        assertThat(complaints.findById(complaint.getId()).orElseThrow().getStatus()).isEqualTo(ComplaintStatus.RESOLVED);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM notification WHERE ref_type='COMPLAINT' AND ref_id=?",
                Long.class, complaint.getId())).isEqualTo(1);
    }

    @Test void simultaneousResolveAndRejectCannotOverwriteEachOther() throws Exception {
        assertThat(race("reject", "{\"reason\":\"Rejected by owner\"}")).containsExactlyInAnyOrder(200, 409);
        Complaint result = complaints.findById(complaint.getId()).orElseThrow();
        assertThat(refundCount()).isEqualTo(result.getStatus() == ComplaintStatus.RESOLVED ? 1 : 0);
        assertThat(result.getStatus()).isIn(ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED);
    }

    List<Integer> race(String secondAction, String secondBody) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
        try {
            Future<Integer> first = pool.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                return decision("resolve", "{\"result\":\"REFUND\"}").statusCode();
            });
            Future<Integer> second = pool.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                return decision(secondAction, secondBody).statusCode();
            });
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            return List.of(first.get(25, TimeUnit.SECONDS), second.get(25, TimeUnit.SECONDS));
        } finally {
            start.countDown();
            pool.shutdownNow();
            assertThat(pool.awaitTermination(25, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test void rejectedRefundRollsBackAndAllowsAValidRetry() throws Exception {
        assertThat(decision("resolve", "{\"result\":\"REFUND\",\"refundAmount\":0}").statusCode()).isEqualTo(400);
        assertThat(refundCount()).isZero();
        assertThat(complaints.findById(complaint.getId()).orElseThrow().getStatus()).isEqualTo(ComplaintStatus.PENDING_OWNER);
        assertThat(decision("resolve", "{\"result\":\"REFUND\"}").statusCode()).isEqualTo(200);
        assertThat(decision("resolve", "{\"result\":\"REFUND\"}").statusCode()).isEqualTo(409);
        assertThat(refundCount()).isEqualTo(1);
    }

    @Test void complaintDecisionWaitsForTheExistingRowLock() throws Exception {
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<HttpResponse<String>> response = new TransactionTemplate(transactions).execute(status -> {
                complaints.findByIdForUpdate(complaint.getId()).orElseThrow();
                Future<HttpResponse<String>> pending = pool.submit(() -> decision("resolve", "{\"result\":\"REFUND\"}"));
                Assertions.assertThrows(TimeoutException.class, () -> pending.get(300, TimeUnit.MILLISECONDS));
                assertThat(refundCount()).isZero();
                return pending;
            });
            assertThat(Objects.requireNonNull(response).get(25, TimeUnit.SECONDS).statusCode()).isEqualTo(200);
            assertThat(refundCount()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
            assertThat(pool.awaitTermination(25, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test void revenueUsesAmountDueAndKeepsDateAndStatusFilters() {
        LocalDate date = LocalDate.now();
        payment("200000", "250000", PaymentStatus.CONFIRMED, date);
        payment("100000", null, PaymentStatus.CONFIRMED, date);
        payment("900000", "900000", PaymentStatus.AWAITING_CONFIRMATION, date);
        payment("800000", "800000", PaymentStatus.CONFIRMED, date.plusDays(1));
        assertThat(reports.sumConfirmedPayments(location.getId(), date, date)).singleElement().satisfies(row -> {
            assertThat(row.getAmount()).isEqualByComparingTo("300000");
            assertThat(row.getCount()).isEqualTo(2);
        });
        assertThat(reports.sumConfirmedPayments(-1L, date, date)).isEmpty();
    }

    void payment(String due, String received, PaymentStatus status, LocalDate date) {
        payments.saveAndFlush(Payment.builder().locationId(location.getId()).bookingId(booking().getId())
                .amountDue(new BigDecimal(due)).receivedAmount(received == null ? null : new BigDecimal(received))
                .status(status).confirmedAt(status == PaymentStatus.CONFIRMED ? date.atTime(12, 0) : null).build());
    }
}
