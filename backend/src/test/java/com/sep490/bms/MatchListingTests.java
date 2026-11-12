package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

import com.sep490.bms.dto.team.MatchResponse;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.service.team.MatchService;

/** F7 – danh sách kèo: kèo của tôi, lọc khung giờ, trình độ chủ kèo (UC28, UC29); chạy trong transaction rollback. */
@SpringBootTest(properties = "bms.scheduler.match-sweep.enabled=false")
@Transactional
class MatchListingTests {

    @Autowired JdbcTemplate jdbc;
    @Autowired LocationRepository locations;
    @Autowired MatchService matches;

    Long hostId;
    Long playerId;
    Long teamId;
    Long locationId;
    Long courtId;
    LocalDate playDate;

    @BeforeEach
    void setUp() {
        hostId = account("Advanced");
        playerId = account(null);
        Long ownerId = account(null);
        jdbc.update("UPDATE account SET role = 'OWNER' WHERE id = ?", ownerId);
        String teamName = "L" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO team (name, captain_id) VALUES (?, ?)", teamName, hostId);
        teamId = jdbc.queryForObject("SELECT id FROM team WHERE name = ?", Long.class, teamName);
        locationId = locations.saveAndFlush(Location.builder().ownerId(ownerId).name("Listing test")
                .address("Test").contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE)
                .build()).getId();
        jdbc.update("INSERT INTO court (location_id, name, is_active) VALUES (?, 'S1', 1)", locationId);
        courtId = jdbc.queryForObject("SELECT MAX(id) FROM court WHERE location_id = ?", Long.class, locationId);
        playDate = LocalDate.now().plusDays(3);
    }

    @Test
    void myMatchesSeparatesHostedAndJoinedAndSkipsRejectedRequests() {
        long hosted = match(booking(480), "OPEN");
        long other = otherHostsMatch(600);
        long rejected = otherHostsMatch(660);
        request(other, playerId, "PENDING");
        request(rejected, playerId, "REJECTED");
        request(hosted, playerId, "APPROVED");

        assertThat(ids(matches.getMyMatches(hostId, "hosted", null, 0, 10).getContent())).containsExactly(hosted);
        assertThat(ids(matches.getMyMatches(playerId, "JOINED", null, 0, 10).getContent()))
                .containsExactlyInAnyOrder(hosted, other);
        assertThat(ids(matches.getMyMatches(playerId, null, null, 0, 10).getContent()))
                .doesNotContain(rejected);
        MatchResponse pending = matches.getMyMatches(playerId, "JOINED", null, 0, 10).getContent().stream()
                .filter(m -> m.getId() == other).findFirst().orElseThrow();
        assertThat(pending.getMyJoinStatus()).isEqualTo("PENDING");
        assertThat(pending.getMyJoinRequestId()).isNotNull();
    }

    @Test
    void myMatchesCanFilterByStatusAndRejectsUnknownRole() {
        match(booking(480), "CANCELLED");
        long open = match(booking(600), "OPEN");

        assertThat(ids(matches.getMyMatches(hostId, "HOSTED", "OPEN", 0, 10).getContent())).containsExactly(open);
        assertThat(matches.getMyMatches(hostId, "HOSTED", null, 0, 10).getTotalElements()).isEqualTo(2);
        assertThatThrownBy(() -> matches.getMyMatches(hostId, "OWNER", null, 0, 10))
                .isInstanceOf(AppException.class);
    }

    @Test
    void openMatchesFilterByStartTimeWindowAndShowHostSkill() {
        long morning = match(booking(480), "OPEN");
        long evening = match(booking(1080), "OPEN");

        List<MatchResponse> eveningOnly = matches
                .getMatches(null, null, locationId, playDate, 1020, 1380, 0, 10).getContent();
        assertThat(ids(eveningOnly)).containsExactly(evening);
        assertThat(eveningOnly.get(0).getHostSkillLevel()).isEqualTo("Advanced");
        assertThat(ids(matches.getMatches(null, null, locationId, playDate, 360, 720, 0, 10).getContent()))
                .containsExactly(morning);
    }

    @Test
    void invalidTimeWindowIsRejected() {
        assertThatThrownBy(() -> matches.getMatches(null, null, null, null, 720, 720, 0, 10))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> matches.getMatches(null, null, null, null, -1, null, 0, 10))
                .isInstanceOf(AppException.class);
    }

    // ---------------------------------------------------------------- fixtures

    private Long account(String skillLevel) {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String phone = "0" + String.format("%09d", Math.floorMod((long) id.hashCode(), 1000000000L));
        jdbc.update("""
                INSERT INTO account (username, email, phone, full_name, password_hash, role, status, skill_level)
                VALUES (?, ?, ?, 'Listing Test', 'test-unused', 'PLAYER', 'ACTIVE', ?)
                """, "l" + id, id + "@example.com", phone, skillLevel);
        return jdbc.queryForObject("SELECT id FROM account WHERE username = ?", Long.class, "l" + id);
    }

    private long booking(int startMinute) {
        return booking(hostId, teamId, startMinute);
    }

    private long booking(Long player, Long team, int startMinute) {
        String code = "L" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        jdbc.update("""
                INSERT INTO booking (booking_code, booking_type, location_id, court_id, player_id, team_id,
                    play_date, start_minute, end_minute, list_amount, final_amount, status)
                VALUES (?, 'SINGLE', ?, ?, ?, ?, ?, ?, ?, 100000, 100000, 'CONFIRMED')
                """, code, locationId, courtId, player, team, java.sql.Date.valueOf(playDate), startMinute,
                startMinute + 60);
        return jdbc.queryForObject("SELECT id FROM booking WHERE booking_code = ?", Long.class, code);
    }

    /** Kèo của một chủ kèo khác, để playerId xin tham gia. */
    private long otherHostsMatch(int startMinute) {
        Long otherHost = account(null);
        String teamName = "L" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO team (name, captain_id) VALUES (?, ?)", teamName, otherHost);
        Long otherTeam = jdbc.queryForObject("SELECT id FROM team WHERE name = ?", Long.class, teamName);
        return match(booking(otherHost, otherTeam, startMinute), "OPEN");
    }

    private long match(long bookingId, String status) {
        jdbc.update("INSERT INTO [match] (booking_id, current_players, needed_players, status) VALUES (?, 2, 2, ?)",
                bookingId, status);
        return jdbc.queryForObject("SELECT MAX(id) FROM [match] WHERE booking_id = ?", Long.class, bookingId);
    }

    private void request(long matchId, Long player, String status) {
        jdbc.update("INSERT INTO match_join_request (match_id, player_id, phone_consent, status) VALUES (?, ?, 1, ?)",
                matchId, player, status);
    }

    private static List<Long> ids(List<MatchResponse> list) {
        return list.stream().map(MatchResponse::getId).toList();
    }
}
