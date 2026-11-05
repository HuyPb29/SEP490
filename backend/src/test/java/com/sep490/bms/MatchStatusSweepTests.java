package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.entity.Location;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.service.team.MatchService;

/** F7 – job cập nhật kèo hết hạn / mất booking gốc; chạy trong transaction rollback. */
@SpringBootTest(properties = "bms.scheduler.match-sweep.enabled=false")
@Transactional
class MatchStatusSweepTests {

    @Autowired JdbcTemplate jdbc;
    @Autowired LocationRepository locations;
    @Autowired MatchService matches;

    Long captainId;
    Long playerId;
    Long teamId;
    Long locationId;
    Long courtId;

    @BeforeEach
    void setUp() {
        captainId = account("PLAYER");
        playerId = account("PLAYER");
        Long ownerId = account("OWNER");
        String teamName = "T" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO team (name, captain_id) VALUES (?, ?)", teamName, captainId);
        teamId = jdbc.queryForObject("SELECT id FROM team WHERE name = ?", Long.class, teamName);
        locationId = locations.saveAndFlush(Location.builder().ownerId(ownerId).name("Match sweep test")
                .address("Test").contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE)
                .build()).getId();
        jdbc.update("INSERT INTO court (location_id, name, is_active) VALUES (?, 'S1', 1)", locationId);
        courtId = jdbc.queryForObject("SELECT MAX(id) FROM court WHERE location_id = ?", Long.class, locationId);
    }

    @Test
    void openMatchPastStartTimeClosesAndPendingRequestsAreCancelled() {
        long match = match(booking("CONFIRMED", LocalDate.now().minusDays(1)), "OPEN");
        long request = joinRequest(match);

        matches.sweepEndedMatches();

        // JOB10, UC28 A5
        assertThat(status("[match]", match)).isEqualTo("CLOSED");
        assertThat(status("match_join_request", request)).isEqualTo("CANCELLED");
    }

    @Test
    void upcomingOpenMatchStaysOpen() {
        long match = match(booking("CONFIRMED", LocalDate.now().plusDays(2)), "OPEN");
        long request = joinRequest(match);

        matches.sweepEndedMatches();

        assertThat(status("[match]", match)).isEqualTo("OPEN");
        assertThat(status("match_join_request", request)).isEqualTo("PENDING");
    }

    @Test
    void matchOfCancelledBookingExpiresEvenWhenClosed() {
        long open = match(booking("CANCELLED_BY_PLAYER", LocalDate.now().plusDays(2)), "OPEN");
        long closed = match(booking("CANCELLED_BY_FACILITY", LocalDate.now().plusDays(3)), "CLOSED");

        matches.sweepEndedMatches();

        // FR101, UC28 A3
        assertThat(status("[match]", open)).isEqualTo("EXPIRED");
        assertThat(status("[match]", closed)).isEqualTo("EXPIRED");
    }

    @Test
    void closedMatchOfValidPastBookingIsNotTouched() {
        long match = match(booking("COMPLETED", LocalDate.now().minusDays(1)), "CLOSED");

        matches.sweepEndedMatches();

        assertThat(status("[match]", match)).isEqualTo("CLOSED");
    }

    @Test
    void rescheduledBookingKeepsItsMatchForTheHostToDecide() {
        long match = match(booking("CONFIRMED", LocalDate.now().plusDays(5)), "OPEN");
        jdbc.update("UPDATE booking SET play_date = ?, reschedule_count = 1 WHERE id = "
                + "(SELECT booking_id FROM [match] WHERE id = ?)", java.sql.Date.valueOf(LocalDate.now().plusDays(6)),
                match);

        matches.sweepEndedMatches();

        // FR90: hệ thống không tự đổi kèo khi đổi lịch, chủ kèo quyết định giữ hay hủy.
        assertThat(status("[match]", match)).isEqualTo("OPEN");
    }

    // ---------------------------------------------------------------- fixtures

    /** Tạo account bằng SQL để không phụ thuộc cột chỉ có trong migration cục bộ. */
    private Long account(String role) {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String phone = "0" + String.format("%09d", Math.floorMod((long) id.hashCode(), 1000000000L));
        jdbc.update("""
                INSERT INTO account (username, email, phone, full_name, password_hash, role, status)
                VALUES (?, ?, ?, 'Match Test', 'test-unused', ?, 'ACTIVE')
                """, "m" + id, id + "@example.com", phone, role);
        return jdbc.queryForObject("SELECT id FROM account WHERE username = ?", Long.class, "m" + id);
    }

    private long booking(String status, LocalDate playDate) {
        String code = "M" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        jdbc.update("""
                INSERT INTO booking (booking_code, booking_type, location_id, court_id, player_id, team_id,
                    play_date, start_minute, end_minute, list_amount, final_amount, status)
                VALUES (?, 'SINGLE', ?, ?, ?, ?, ?, 480, 540, 100000, 100000, ?)
                """, code, locationId, courtId, captainId, teamId, java.sql.Date.valueOf(playDate), status);
        return jdbc.queryForObject("SELECT id FROM booking WHERE booking_code = ?", Long.class, code);
    }

    private long match(long bookingId, String status) {
        jdbc.update("INSERT INTO [match] (booking_id, current_players, needed_players, status) VALUES (?, 2, 2, ?)",
                bookingId, status);
        return jdbc.queryForObject("SELECT id FROM [match] WHERE booking_id = ?", Long.class, bookingId);
    }

    private long joinRequest(long matchId) {
        jdbc.update("INSERT INTO match_join_request (match_id, player_id, phone_consent) VALUES (?, ?, 1)",
                matchId, playerId);
        return jdbc.queryForObject("SELECT id FROM match_join_request WHERE match_id = ?", Long.class, matchId);
    }

    private String status(String table, long id) {
        return jdbc.queryForObject("SELECT status FROM " + table + " WHERE id = ?", String.class, id);
    }
}
