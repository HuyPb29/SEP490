package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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

/** F7 – thông báo kèo MSG75/MSG76 (FR90, FR100, FR102, FR124); chạy trong transaction rollback. */
@SpringBootTest(properties = "bms.scheduler.match-sweep.enabled=false")
@Transactional
class MatchNotificationTests {

    @Autowired JdbcTemplate jdbc;
    @Autowired LocationRepository locations;
    @Autowired MatchService matches;

    Long hostId;
    Long memberId;
    Long applicantId;
    Long teamId;
    Long locationId;
    Long courtId;

    @BeforeEach
    void setUp() {
        hostId = account("PLAYER");
        memberId = account("PLAYER");
        applicantId = account("PLAYER");
        Long ownerId = account("OWNER");
        String teamName = "N" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO team (name, captain_id) VALUES (?, ?)", teamName, hostId);
        teamId = jdbc.queryForObject("SELECT id FROM team WHERE name = ?", Long.class, teamName);
        locationId = locations.saveAndFlush(Location.builder().ownerId(ownerId).name("Notify test")
                .address("Test").contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE)
                .build()).getId();
        jdbc.update("INSERT INTO court (location_id, name, is_active) VALUES (?, 'S1', 1)", locationId);
        courtId = jdbc.queryForObject("SELECT MAX(id) FROM court WHERE location_id = ?", Long.class, locationId);
    }

    @Test
    void hostCancellingNotifiesApprovedMembersAndPendingApplicants() {
        long match = match(booking("CONFIRMED", LocalDate.now().plusDays(2)), "OPEN");
        request(match, memberId, "APPROVED");
        request(match, applicantId, "PENDING");

        matches.cancelMatch(hostId, match);

        assertThat(types(memberId)).containsExactly("MATCH_CANCELLED");
        assertThat(types(applicantId)).containsExactly("MATCH_REQUEST_CANCELLED");
        assertThat(types(hostId)).isEmpty();
    }

    @Test
    void autoCloseAtStartTimeNotifiesOnlyPendingApplicants() {
        long match = match(booking("CONFIRMED", LocalDate.now().minusDays(1)), "OPEN");
        request(match, memberId, "APPROVED");
        request(match, applicantId, "PENDING");

        matches.sweepEndedMatches();

        assertThat(types(memberId)).isEmpty();
        assertThat(types(applicantId)).containsExactly("MATCH_REQUEST_CANCELLED");
    }

    @Test
    void cancelledBookingExpiresMatchAndNotifiesEveryone() {
        long match = match(booking("CANCELLED_BY_FACILITY", LocalDate.now().plusDays(2)), "OPEN");
        request(match, memberId, "APPROVED");
        request(match, applicantId, "PENDING");

        matches.sweepEndedMatches();

        assertThat(types(memberId)).containsExactly("MATCH_EXPIRED");
        assertThat(types(applicantId)).containsExactly("MATCH_REQUEST_CANCELLED");
    }

    @Test
    void rescheduledBookingAsksHostToDecideAndInformsPlayers() {
        long booking = booking("CONFIRMED", LocalDate.now().plusDays(2));
        long match = match(booking, "OPEN");
        request(match, memberId, "APPROVED");
        request(match, applicantId, "PENDING");

        matches.onBookingRescheduled(booking);

        assertThat(types(hostId)).containsExactly("MATCH_RESCHEDULED_HOST");
        assertThat(types(memberId)).containsExactly("MATCH_RESCHEDULED");
        assertThat(types(applicantId)).containsExactly("MATCH_RESCHEDULED");
        assertThat(jdbc.queryForObject("SELECT status FROM [match] WHERE id = ?", String.class, match))
                .isEqualTo("OPEN");
    }

    @Test
    void rescheduleOfBookingWithoutActiveMatchSendsNothing() {
        long booking = booking("CONFIRMED", LocalDate.now().plusDays(2));

        matches.onBookingRescheduled(booking);

        assertThat(types(hostId)).isEmpty();
    }

    // ---------------------------------------------------------------- fixtures

    /** Tạo account bằng SQL để không phụ thuộc cột chỉ có trong migration cục bộ. */
    private Long account(String role) {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String phone = "0" + String.format("%09d", Math.floorMod((long) id.hashCode(), 1000000000L));
        jdbc.update("""
                INSERT INTO account (username, email, phone, full_name, password_hash, role, status)
                VALUES (?, ?, ?, 'Notify Test', 'test-unused', ?, 'ACTIVE')
                """, "n" + id, id + "@example.com", phone, role);
        return jdbc.queryForObject("SELECT id FROM account WHERE username = ?", Long.class, "n" + id);
    }

    private long booking(String status, LocalDate playDate) {
        String code = "N" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        jdbc.update("""
                INSERT INTO booking (booking_code, booking_type, location_id, court_id, player_id, team_id,
                    play_date, start_minute, end_minute, list_amount, final_amount, status)
                VALUES (?, 'SINGLE', ?, ?, ?, ?, ?, 480, 540, 100000, 100000, ?)
                """, code, locationId, courtId, hostId, teamId, java.sql.Date.valueOf(playDate), status);
        return jdbc.queryForObject("SELECT id FROM booking WHERE booking_code = ?", Long.class, code);
    }

    private long match(long bookingId, String status) {
        jdbc.update("INSERT INTO [match] (booking_id, current_players, needed_players, status) VALUES (?, 2, 2, ?)",
                bookingId, status);
        return jdbc.queryForObject("SELECT id FROM [match] WHERE booking_id = ?", Long.class, bookingId);
    }

    private void request(long matchId, Long playerId, String status) {
        jdbc.update("INSERT INTO match_join_request (match_id, player_id, phone_consent, status) VALUES (?, ?, 1, ?)",
                matchId, playerId, status);
    }

    private List<String> types(Long recipientId) {
        return jdbc.queryForList("SELECT type FROM notification WHERE recipient_id = ? ORDER BY id", String.class,
                recipientId);
    }
}
