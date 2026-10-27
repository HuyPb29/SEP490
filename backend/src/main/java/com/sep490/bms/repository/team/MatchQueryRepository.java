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
                   t.captain_id AS host_id, a.full_name AS host_name, a.phone AS host_phone,
                   b.location_id, l.name AS location_name, c.name AS court_name,
                   b.play_date, b.start_minute, b.end_minute,
                   m.current_players, m.needed_players, m.status, m.created_at, m.closed_at
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
                .locationId(rs.getLong("location_id"))
                .locationName(rs.getString("location_name"))
                .courtName(rs.getString("court_name"))
                .playDate(rs.getDate("play_date").toLocalDate())
                .startMinute(rs.getInt("start_minute"))
                .endMinute(rs.getInt("end_minute"))
                .currentPlayers(rs.getInt("current_players"))
                .neededPlayers(rs.getInt("needed_players"))
                .status(rs.getString("status"))
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

    public List<MatchResponse> searchMatches(String status, Long locationId, LocalDate playDate, boolean upcomingOnly,
                                             int offset, int size) {
        List<Object> params = new ArrayList<>();
        String where = buildWhere(status, locationId, playDate, upcomingOnly, params);
        params.add(offset);
        params.add(size);
        return jdbcTemplate.query(
                MATCH_SELECT + where + " ORDER BY b.play_date, b.start_minute, m.id OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                MATCH_MAPPER, params.toArray());
    }

    public long countMatches(String status, Long locationId, LocalDate playDate, boolean upcomingOnly) {
        List<Object> params = new ArrayList<>();
        String where = buildWhere(status, locationId, playDate, upcomingOnly, params);
        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM [match] m JOIN booking b ON b.id = m.booking_id" + where, Long.class, params.toArray());
        return total == null ? 0 : total;
    }

    private String buildWhere(String status, Long locationId, LocalDate playDate, boolean upcomingOnly, List<Object> params) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        if (status != null) {
            where.append(" AND m.status = ?");
            params.add(status);
        }
        if (locationId != null) {
            where.append(" AND b.location_id = ?");
            params.add(locationId);
        }
        if (playDate != null) {
            where.append(" AND b.play_date = ?");
            params.add(Date.valueOf(playDate));
        }
        if (upcomingOnly) {
            where.append(" AND b.play_date >= CAST(SYSDATETIME() AS DATE)");
        }
        return where.toString();
    }
}
