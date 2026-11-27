package com.sep490.bms.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.booking.RescheduleChange;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.reschedule.RescheduleHistoryQuery;

/** UC17/UC21: dựng lại "đổi từ slot nào sang slot nào"; chạy trong transaction rollback. */
@SpringBootTest
@Transactional
class RescheduleHistoryQueryTests {

    @Autowired JdbcTemplate jdbc;
    @Autowired LocationRepository locations;
    @Autowired RescheduleHistoryQuery history;
    @Autowired com.sep490.bms.service.reschedule.RescheduleService reschedules;

    // Ngày xa để không đụng slot đang giữ của dữ liệu mẫu (ux_slot_active).
    final LocalDate day1 = LocalDate.of(2099, 1, 5);
    final LocalDate day2 = LocalDate.of(2099, 1, 6);
    final LocalDate day3 = LocalDate.of(2099, 1, 7);
    Long locationId;
    Long courtA;
    Long courtB;
    Long playerId;

    @BeforeEach
    void setUp() {
        Long ownerId = account("OWNER");
        playerId = account("PLAYER");
        locationId = locations.saveAndFlush(Location.builder().ownerId(ownerId).name("History test")
                .address("Test").contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE)
                .build()).getId();
        courtA = court("Sân A");
        courtB = court("Sân B");
    }

    @Test
    void firstChangeStartsFromOriginalSlotsAndNextFromPreviousChange() {
        long booking = booking(null, courtA, day1, 1050, 1140); // 17:30–19:00
        reschedule(booking, courtB, day2, 1080, 1170, "2099-01-01T10:00:00");
        reschedule(booking, courtA, day3, 1200, 1290, "2099-01-02T10:00:00");
        rejectedReschedule(booking);

        List<RescheduleChange> changes = history.byBookingIds(List.of(booking)).get(booking);

        assertThat(changes).hasSize(2);
        RescheduleChange first = changes.get(0);
        assertThat(first.fromCourtName()).isEqualTo("Sân A");
        assertThat(first.fromDate()).isEqualTo(day1);
        assertThat(first.fromStartTime()).isEqualTo("17:30");
        assertThat(first.fromEndTime()).isEqualTo("19:00");
        assertThat(first.toCourtName()).isEqualTo("Sân B");
        assertThat(first.toDate()).isEqualTo(day2);
        assertThat(first.toStartTime()).isEqualTo("18:00");
        assertThat(first.toEndTime()).isEqualTo("19:30");
        RescheduleChange second = changes.get(1);
        assertThat(second.fromCourtName()).isEqualTo("Sân B");
        assertThat(second.fromStartTime()).isEqualTo("18:00");
        assertThat(second.toDate()).isEqualTo(day3);
        assertThat(second.toStartTime()).isEqualTo("20:00");
    }

    @Test
    void packageCollectsChangesOfEverySession() {
        long pkg = jdbc.queryForObject("""
                INSERT INTO booking_package (location_id, player_id, package_type, start_date, end_date, list_amount,
                    final_amount, status)
                OUTPUT inserted.id VALUES (?, ?, 'CUSTOM', ?, ?, 240000, 240000, 'CONFIRMED')
                """, Long.class, locationId, playerId, Date.valueOf(day1), Date.valueOf(day3));
        long moved = booking(pkg, courtA, day1, 480, 540);
        booking(pkg, courtA, day3, 480, 540);
        reschedule(moved, courtB, day2, 600, 660, "2099-01-01T08:00:00");

        var byPackage = history.byPackageIds(List.of(pkg));

        assertThat(byPackage.get(pkg)).singleElement().satisfies(change -> {
            assertThat(change.bookingId()).isEqualTo(moved);
            assertThat(change.fromStartTime()).isEqualTo("08:00");
            assertThat(change.toCourtName()).isEqualTo("Sân B");
            assertThat(change.toStartTime()).isEqualTo("10:00");
        });
        assertThat(history.byPackageIds(List.of())).isEmpty();
    }

    @Test
    void surchargeTotalsCountOnlyConfirmedPaymentsForApprovedChangesAndExposeCourtNames() {
        long booking = booking(null, courtA, day1, 480, 510);
        reschedule(booking, courtB, day2, 1020, 1080, "2099-01-01T10:00:00");
        long request = jdbc.queryForObject("SELECT id FROM reschedule_request WHERE booking_id=?", Long.class, booking);
        long payment = jdbc.queryForObject("""
                INSERT INTO payment (location_id, reschedule_request_id, amount_due, received_amount, status)
                OUTPUT inserted.id VALUES (?, ?, 95000, 100000, 'CONFIRMED')
                """, Long.class, locationId, request);
        assertThat(history.surchargesByBookingIds(List.of(booking)).get(booking)).isEqualByComparingTo("95000");
        assertThat(history.surchargesByBookingIds(List.of())).isEmpty();
        var player = com.sep490.bms.security.UserPrincipal.builder().id(playerId)
                .role(com.sep490.bms.entity.account.Role.PLAYER).build();
        assertThat(reschedules.requests(player, booking)).singleElement().satisfies(r -> assertThat(r.getNewCourtName()).isEqualTo("Sân B"));
        var detail = reschedules.payment(player, payment);
        String code = jdbc.queryForObject("SELECT booking_code FROM booking WHERE id=?", String.class, booking);
        assertThat(detail.bookingCode()).isEqualTo(code);
        assertThat(detail.customerName()).isEqualTo("History Test");
        assertThat(detail.customerPhone()).isNotBlank();
        assertThat(detail.courtName()).isEqualTo("Sân B");
        assertThat(detail.playDate()).isEqualTo(day2);
        assertThat(detail.startTime()).isEqualTo("17:00");
        assertThat(detail.endTime()).isEqualTo("18:00");
        assertThat(detail.transferContent()).isEqualTo(code + " DL" + request);
        jdbc.update("UPDATE payment SET status='AWAITING_CONFIRMATION' WHERE id=?", payment);
        assertThat(history.surchargesByBookingIds(List.of(booking))).isEmpty();
        jdbc.update("UPDATE payment SET status='CONFIRMED' WHERE id=?", payment);
        jdbc.update("UPDATE reschedule_request SET status='REJECTED' WHERE id=?", request);
        assertThat(history.surchargesByBookingIds(List.of(booking))).isEmpty();
    }

    // ---------------------------------------------------------------- fixtures

    private Long account(String role) {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String phone = "0" + String.format("%09d", Math.floorMod((long) id.hashCode(), 1000000000L));
        return jdbc.queryForObject("""
                INSERT INTO account (username, email, phone, full_name, password_hash, role, status)
                OUTPUT inserted.id VALUES (?, ?, ?, 'History Test', 'test-unused', ?, 'ACTIVE')
                """, Long.class, "h" + id, id + "@example.com", phone, role);
    }

    private Long court(String name) {
        return jdbc.queryForObject("INSERT INTO court (location_id, name, is_active) OUTPUT inserted.id VALUES (?, ?, 1)",
                Long.class, locationId, name);
    }

    /** Booking cùng các dòng slot gốc 30 phút (đã nhả vì giờ đã đổi). */
    private long booking(Long packageId, Long courtId, LocalDate date, int start, int end) {
        String code = "H" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        long id = jdbc.queryForObject("""
                INSERT INTO booking (booking_code, booking_type, package_id, location_id, court_id, player_id,
                    play_date, start_minute, end_minute, list_amount, final_amount, status)
                OUTPUT inserted.id VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 60000, 60000, 'CONFIRMED')
                """, Long.class, code, packageId == null ? "SINGLE" : "SESSION", packageId, locationId, courtId,
                playerId, Date.valueOf(date), start, end);
        for (int m = start; m < end; m += 30) {
            jdbc.update("""
                    INSERT INTO booking_slot (booking_id, court_id, slot_date, slot_start_minute, price, is_active)
                    VALUES (?, ?, ?, ?, 30000, 0)
                    """, id, courtId, Date.valueOf(date), m);
        }
        return id;
    }

    private void reschedule(long bookingId, Long courtId, LocalDate date, int start, int end, String decidedAt) {
        jdbc.update("""
                INSERT INTO reschedule_request (booking_id, new_court_id, new_date, new_start_minute, new_end_minute,
                    old_list_amount, new_list_amount, status, decided_at)
                VALUES (?, ?, ?, ?, ?, 60000, 60000, 'APPROVED', ?)
                """, bookingId, courtId, Date.valueOf(date), start, end, java.sql.Timestamp.valueOf(
                        java.time.LocalDateTime.parse(decidedAt)));
    }

    private void rejectedReschedule(long bookingId) {
        jdbc.update("""
                INSERT INTO reschedule_request (booking_id, new_court_id, new_date, new_start_minute, new_end_minute,
                    old_list_amount, new_list_amount, status, decided_at)
                VALUES (?, ?, ?, 600, 660, 60000, 60000, 'REJECTED', SYSDATETIME())
                """, bookingId, courtB, Date.valueOf(day2));
    }
}
