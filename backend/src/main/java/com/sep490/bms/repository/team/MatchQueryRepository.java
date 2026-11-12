package com.sep490.bms.repository.team;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.sep490.bms.dto.team.MatchResponse;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Truy vấn đọc cho kèo, join với booking/court/location (module booking chưa có entity nên dùng SQL trực tiếp).
 * Chủ kèo = đội trưởng của đội đứng tên booking.
 */
@Repository
@RequiredArgsConstructor
public class MatchQueryRepository {

    private static final String MATCH_SELECT = """
            SELECT m.id, m.booking_id, b.booking_code, b.team_id, t.name AS team_name,
                   t.captain_id AS host_id, a.full_name AS host_name, a.phone AS host_phone, a.skill_level AS host_skill_level,
                   b.location_id, l.name AS location_name, c.name AS court_name,
                   b.play_date, b.start_minute, b.end_minute,
                   m.current_players, m.needed_players, m.status, m.created_at, m.closed_at, m.reschedule_pending
            FROM [match] m
            JOIN booking b ON b.id = m.booking_id
            JOIN team t ON t.id = b.team_id
            JOIN account a ON a.id = t.captain_id
            JOIN court c ON c.id = b.court_id
            JOIN location l ON l.id = b.location_id
            """;

    private static final RowMapper<MatchResponse> MATCH_MAPPER = (rs, i) -> {
        Timestamp closedAt = rs.getTimestamp("closed_at");
        return MatchResponse.builder()
                .id(rs.getLong("id"))
                .bookingId(rs.getLong("booking_id"))
                .bookingCode(rs.getString("booking_code"))
                .teamId(rs.getLong("team_id"))
                .teamName(rs.getString("team_name"))
                .hostId(rs.getLong("host_id"))
                .hostName(rs.getString("host_name"))
                .hostPhone(rs.getString("host_phone"))
                .hostSkillLevel(rs.getString("host_skill_level"))
                .locationId(rs.getLong("location_id"))
                .locationName(rs.getString("location_name"))
                .courtName(rs.getString("court_name"))
                .playDate(rs.getDate("play_date").toLocalDate())
                .startMinute(rs.getInt("start_minute"))
                .endMinute(rs.getInt("end_minute"))
                .currentPlayers(rs.getInt("current_players"))
                .neededPlayers(rs.getInt("needed_players"))
                .status(rs.getString("status"))
                .reschedulePending(rs.getBoolean("reschedule_pending"))
                .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                .closedAt(closedAt == null ? null : closedAt.toLocalDateTime())
                .build();
    };

    private final JdbcTemplate jdbcTemplate;

    @Getter
    @AllArgsConstructor
    public static class BookingInfo {
        private final Long id;
        private final String bookingCode;
        private final Long teamId;
        private final String status;
        private final LocalDate playDate;
        private final int startMinute;
    }

    public Optional<BookingInfo> findBooking(Long bookingId) {
        List<BookingInfo> rows = jdbcTemplate.query(
                "SELECT id, booking_code, team_id, status, play_date, start_minute FROM booking WHERE id = ?",
                (rs, i) -> new BookingInfo(
                        rs.getLong("id"),
                        rs.getString("booking_code"),
                        (Long) rs.getObject("team_id"),
                        rs.getString("status"),
                        rs.getDate("play_date").toLocalDate(),
                        rs.getInt("start_minute")),
                bookingId);
        return rows.stream().findFirst();
    }

    public Optional<MatchResponse> findMatch(Long matchId) {
        return jdbcTemplate.query(MATCH_SELECT + " WHERE m.id = ?", MATCH_MAPPER, matchId).stream().findFirst();
    }

    /**
     * Điều kiện lọc danh sách kèo (UC29). fromMinute/toMinute lọc theo giờ bắt đầu trong ngày,
     * nửa mở [fromMinute, toMinute) để khung sáng/chiều/tối không trùng nhau.
     */
    public record MatchFilter(String status, Long locationId, LocalDate playDate,
                              Integer fromMinute, Integer toMinute, boolean upcomingOnly) {
    }

    public List<MatchResponse> searchMatches(MatchFilter filter, int offset, int size) {
        List<Object> params = new ArrayList<>();
        String where = buildWhere(filter, params);
        params.add(offset);
        params.add(size);
        return jdbcTemplate.query(
                MATCH_SELECT + where + " ORDER BY b.play_date, b.start_minute, m.id OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                MATCH_MAPPER, params.toArray());
    }

    public long countMatches(MatchFilter filter) {
        List<Object> params = new ArrayList<>();
        String where = buildWhere(filter, params);
        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM [match] m JOIN booking b ON b.id = m.booking_id" + where, Long.class, params.toArray());
        return total == null ? 0 : total;
    }

    /**
     * "Kèo của tôi": kèo người chơi làm chủ (HOSTED), kèo họ đã gửi yêu cầu còn chờ hoặc đã được duyệt (JOINED),
     * hoặc cả hai khi role = null. Mới nhất lên đầu.
     */
    public List<MatchResponse> findMyMatches(Long playerId, String role, String status, int offset, int size) {
        List<Object> params = new ArrayList<>();
        String where = buildMyWhere(playerId, role, status, params);
        params.add(offset);
        params.add(size);
        return jdbcTemplate.query(
                MATCH_SELECT + where + " ORDER BY b.play_date DESC, b.start_minute DESC, m.id DESC"
                        + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                MATCH_MAPPER, params.toArray());
    }

    public long countMyMatches(Long playerId, String role, String status) {
        List<Object> params = new ArrayList<>();
        String where = buildMyWhere(playerId, role, status, params);
        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM [match] m JOIN booking b ON b.id = m.booking_id JOIN team t ON t.id = b.team_id"
                        + where, Long.class, params.toArray());
        return total == null ? 0 : total;
    }

    private static final String JOINED_CONDITION = """
            EXISTS (SELECT 1 FROM match_join_request r
                    WHERE r.match_id = m.id AND r.player_id = ? AND r.status IN ('PENDING', 'APPROVED'))""";

    private String buildMyWhere(Long playerId, String role, String status, List<Object> params) {
        StringBuilder where = new StringBuilder(" WHERE ");
        if ("HOSTED".equals(role)) {
            where.append("t.captain_id = ?");
            params.add(playerId);
        } else if ("JOINED".equals(role)) {
            where.append(JOINED_CONDITION);
            params.add(playerId);
        } else {
            where.append("(t.captain_id = ? OR ").append(JOINED_CONDITION).append(")");
            params.add(playerId);
            params.add(playerId);
        }
        if (status != null) {
            where.append(" AND m.status = ?");
            params.add(status);
        }
        return where.toString();
    }

    /** JOB10, UC28 A5: kèo vẫn đang tuyển mà giờ chơi đã bắt đầu. */
    public List<Long> findStartedOpenMatchIds() {
        return jdbcTemplate.queryForList("""
                SELECT m.id FROM [match] m JOIN booking b ON b.id = m.booking_id
                WHERE m.status = 'OPEN'
                  AND DATEADD(MINUTE, b.start_minute, CAST(b.play_date AS DATETIME2)) <= SYSDATETIME()
                """, Long.class);
    }

    /** FR101, UC28 A3: kèo còn hiệu lực nhưng booking đã bị người chơi hoặc sân hủy. */
    public List<Long> findActiveMatchIdsOfCancelledBookings() {
        return jdbcTemplate.queryForList("""
                SELECT m.id FROM [match] m JOIN booking b ON b.id = m.booking_id
                WHERE m.status IN ('OPEN', 'CLOSED')
                  AND b.status IN ('CANCELLED_BY_PLAYER', 'CANCELLED_BY_FACILITY')
                """, Long.class);
    }

    private String buildWhere(MatchFilter filter, List<Object> params) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        if (filter.status() != null) {
            where.append(" AND m.status = ?");
            params.add(filter.status());
        }
        if (filter.locationId() != null) {
            where.append(" AND b.location_id = ?");
            params.add(filter.locationId());
        }
        if (filter.playDate() != null) {
            where.append(" AND b.play_date = ?");
            params.add(Date.valueOf(filter.playDate()));
        }
        if (filter.fromMinute() != null) {
            where.append(" AND b.start_minute >= ?");
            params.add(filter.fromMinute());
        }
        if (filter.toMinute() != null) {
            where.append(" AND b.start_minute < ?");
            params.add(filter.toMinute());
        }
        if (filter.upcomingOnly()) {
            where.append(" AND b.play_date >= CAST(SYSDATETIME() AS DATE)");
        }
        return where.toString();
    }
}
