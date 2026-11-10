package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.sep490.bms.dto.feedback.HideReviewRequest;
import com.sep490.bms.entity.AccountStatus;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.feedback.ReviewService;
import com.sep490.bms.service.operation.OperationService;

/** F8 Owner ẩn đánh giá và F9 báo cáo hủy / đổi lịch / voucher; chạy trong transaction rollback. */
@SpringBootTest
@Transactional
class OperationReportAndReviewHideTests {

    @Autowired LocationRepository locations;
    @Autowired JdbcTemplate jdbc;
    @Autowired OperationService operations;
    @Autowired ReviewService reviews;

    TestUser owner;
    TestUser otherOwner;
    TestUser player;
    Location location;
    Long courtId;
    LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() {
        owner = account(Role.OWNER);
        otherOwner = account(Role.OWNER);
        player = account(Role.PLAYER);
        location = locations.saveAndFlush(Location.builder().ownerId(owner.id()).name("Report test")
                .address("Test").contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE)
                .build());
        jdbc.update("INSERT INTO court (location_id, name, is_active) VALUES (?, 'S1', 1)", location.getId());
        courtId = jdbc.queryForObject("SELECT MAX(id) FROM court WHERE location_id = ?", Long.class,
                location.getId());
        select(location.getId());
    }

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void cancellationReportCountsByWhoCancelled() {
        booking("CANCELLED_BY_PLAYER", 100000);
        booking("CANCELLED_BY_PLAYER", 50000);
        booking("CANCELLED_BY_FACILITY", 70000);
        booking("COMPLETED", 90000);

        var report = operations.getCancellationReport(principal(owner), today, today);

        assertThat(report.getTotalCancelled()).isEqualTo(3);
        assertThat(report.getCancelledByPlayer()).isEqualTo(2);
        assertThat(report.getCancelledByFacility()).isEqualTo(1);
        assertThat(report.getCancelledAmount()).isEqualByComparingTo("220000");
        assertThat(report.getDaily()).hasSize(1);
    }

    @Test
    void rescheduleReportSeparatesFreeAndPaidAndSumsApprovedExtra() {
        long booking = booking("CONFIRMED", 100000);
        reschedule(booking, "APPROVED", 0, true);
        reschedule(booking, "REJECTED", 30000, false);
        reschedule(booking, "APPROVED", 40000, false);

        var report = operations.getRescheduleReport(principal(owner), today, today);

        assertThat(report.getTotalRequests()).isEqualTo(3);
        assertThat(report.getApproved()).isEqualTo(2);
        assertThat(report.getFreeRequests()).isEqualTo(1);
        assertThat(report.getPaidRequests()).isEqualTo(2);
        assertThat(report.getExtraAmount()).isEqualByComparingTo("40000");
        assertThat(report.getByStatus()).containsEntry("REJECTED", 1L);
    }

    @Test
    void voucherReportGroupsByVoucherAndIgnoresReturnedDiscount() {
        long booking = booking("COMPLETED", 100000);
        long voucher = voucher();
        usage(voucher, booking, 20000, "USED");
        long booking2 = booking("COMPLETED", 100000);
        usage(voucher, booking2, 15000, "RETURNED");

        var report = operations.getVoucherReport(principal(owner), today, today);

        assertThat(report.getUsedCount()).isEqualTo(1);
        assertThat(report.getReturnedCount()).isEqualTo(1);
        assertThat(report.getTotalDiscount()).isEqualByComparingTo("20000");
        assertThat(report.getVouchers()).hasSize(1);
        assertThat(report.getVouchers().get(0).getTotalDiscount()).isEqualByComparingTo("20000");
    }

    @Test
    void staffDashboardAndRevenueReportCountAmountDueNotOverpayment() {
        // BR37, BR51: khách chuyển thừa 20.000 thì doanh thu vẫn chỉ tính số tiền phải trả.
        payment(booking("CONFIRMED", 100000), 100000, 120000L);
        payment(booking("CONFIRMED", 50000), 50000, null);
        UserPrincipal staff = UserPrincipal.builder().id(owner.id()).username("staff").role(Role.STAFF)
                .locationId(location.getId()).status(AccountStatus.ACTIVE).authorities(List.of()).build();

        assertThat(operations.getStaffDashboard(staff).getTodayRevenue()).isEqualByComparingTo("150000");
        var report = operations.getRevenueReport(principal(owner), today, today);
        assertThat(report.getTotalRevenue()).isEqualByComparingTo("150000");
        assertThat(report.getPaymentCount()).isEqualTo(2);
    }

    @Test
    void staffDashboardCountsOverduePaymentsAndListsActiveCourts() {
        awaiting(booking("AWAITING_CONFIRMATION", 100000), 20);
        awaiting(booking("AWAITING_CONFIRMATION", 80000), 5);
        jdbc.update("INSERT INTO court (location_id, name, is_active) VALUES (?, 'S2 off', 0)", location.getId());
        UserPrincipal staff = UserPrincipal.builder().id(owner.id()).username("staff").role(Role.STAFF)
                .locationId(location.getId()).status(AccountStatus.ACTIVE).authorities(List.of()).build();

        var dashboard = operations.getStaffDashboard(staff);

        assertThat(dashboard.getPaymentsAwaitingConfirmation()).isEqualTo(2);
        assertThat(dashboard.getOverduePayments()).isEqualTo(1);
        assertThat(dashboard.getPaymentOverdueMinutes()).isEqualTo(15);
        assertThat(dashboard.getCourts()).extracting("courtName").containsExactly("S1");
    }

    @Test
    void reportsRejectRangeLongerThanAYear() {
        assertThatThrownBy(() -> operations.getVoucherReport(principal(owner),
                today.minusDays(400), today)).isInstanceOf(AppException.class);
    }

    @Test
    void ownerCanHideAndRestoreOwnReview() {
        long review = review(booking("COMPLETED", 100000));
        var principal = principal(owner);

        assertThat(reviews.setOwnerHidden(principal, review, new HideReviewRequest(true)).isHidden()).isTrue();
        assertThat(reviews.setOwnerHidden(principal, review, new HideReviewRequest(false)).isHidden()).isFalse();
    }

    @Test
    void ownerCannotHideReviewOfAnotherLocation() {
        long review = review(booking("COMPLETED", 100000));
        Location foreign = locations.saveAndFlush(Location.builder().ownerId(otherOwner.id())
                .name("Foreign").address("Test").contactPhone("0987654321").latitude(BigDecimal.ONE)
                .longitude(BigDecimal.ONE).build());
        select(foreign.getId());

        assertThatThrownBy(() -> reviews.setOwnerHidden(principal(otherOwner), review,
                new HideReviewRequest(true)))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void ownerCannotRestoreReviewHiddenByAdmin() {
        long review = review(booking("COMPLETED", 100000));
        TestUser admin = account(Role.ADMIN);
        reviews.setHidden(admin.id(), review, new HideReviewRequest(true));

        assertThatThrownBy(() -> reviews.setOwnerHidden(principal(owner), review,
                new HideReviewRequest(false)))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    // ---------------------------------------------------------------- fixtures

    private void select(Long locationId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Location-Id", locationId);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    /** Tạo account bằng SQL để không phụ thuộc cột chỉ có trong migration cục bộ. */
    private TestUser account(Role role) {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String phone = "0" + String.format("%09d", Math.floorMod((long) id.hashCode(), 1000000000L));
        jdbc.update("""
                INSERT INTO account (username, email, phone, full_name, password_hash, role, status)
                VALUES (?, ?, ?, 'Report Test', 'test-unused', ?, 'ACTIVE')
                """, "r" + id, id + "@example.com", phone, role.name());
        Long accountId = jdbc.queryForObject("SELECT id FROM account WHERE username = ?", Long.class, "r" + id);
        return new TestUser(accountId, role);
    }

    private UserPrincipal principal(TestUser user) {
        return UserPrincipal.builder().id(user.id()).username("u" + user.id()).role(user.role())
                .status(AccountStatus.ACTIVE).authorities(List.of()).build();
    }

    private record TestUser(Long id, Role role) { }


    private long booking(String status, long amount) {
        String code = "T" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        jdbc.update("""
                INSERT INTO booking (booking_code, booking_type, location_id, court_id, player_id, play_date,
                    start_minute, end_minute, list_amount, final_amount, status)
                VALUES (?, 'SINGLE', ?, ?, ?, ?, 480, 540, ?, ?, ?)
                """, code, location.getId(), courtId, player.id(), java.sql.Date.valueOf(today), amount, amount,
                status);
        return jdbc.queryForObject("SELECT id FROM booking WHERE booking_code = ?", Long.class, code);
    }

    private void payment(long booking, long due, Long received) {
        jdbc.update("""
                INSERT INTO payment (location_id, booking_id, amount_due, received_amount, status, confirmed_at)
                VALUES (?, ?, ?, ?, 'CONFIRMED', SYSDATETIME())
                """, location.getId(), booking, due, received);
    }

    /** Giao dịch chờ xác nhận, Player báo đã chuyển khoản cách đây minutesAgo phút. */
    private void awaiting(long booking, int minutesAgo) {
        jdbc.update("""
                INSERT INTO payment (location_id, booking_id, amount_due, status, submitted_at)
                VALUES (?, ?, 100000, 'AWAITING_CONFIRMATION', DATEADD(MINUTE, ?, SYSDATETIME()))
                """, location.getId(), booking, -minutesAgo);
    }

    private void reschedule(long booking, String status, long extra, boolean free) {
        jdbc.update("""
                INSERT INTO reschedule_request (booking_id, new_court_id, new_date, new_start_minute,
                    new_end_minute, old_list_amount, new_list_amount, extra_amount, is_free, status)
                VALUES (?, ?, ?, 540, 600, 100000, 100000, ?, ?, ?)
                """, booking, courtId, java.sql.Date.valueOf(today.plusDays(1)), extra, free, status);
    }

    private long voucher() {
        String code = "V" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        jdbc.update("""
                INSERT INTO voucher (location_id, code, name, source, target_group, discount_type,
                    discount_value, status)
                VALUES (?, ?, 'Test voucher', 'CAMPAIGN', 'ALL_PLAYERS', 'AMOUNT', 20000, 'PUBLISHED')
                """, location.getId(), code);
        return jdbc.queryForObject("SELECT id FROM voucher WHERE code = ?", Long.class, code);
    }

    private void usage(long voucher, long booking, long discount, String status) {
        jdbc.update("""
                INSERT INTO voucher_usage (voucher_id, player_id, booking_id, discount_amount, status)
                VALUES (?, ?, ?, ?, ?)
                """, voucher, player.id(), booking, discount, status);
    }

    private long review(long booking) {
        jdbc.update("INSERT INTO review (booking_id, location_id, player_id, rating) VALUES (?, ?, ?, 5)",
                booking, location.getId(), player.id());
        return jdbc.queryForObject("SELECT id FROM review WHERE booking_id = ?", Long.class, booking);
    }
}
