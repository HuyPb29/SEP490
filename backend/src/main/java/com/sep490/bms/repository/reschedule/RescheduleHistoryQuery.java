package com.sep490.bms.repository.reschedule;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.dto.booking.RescheduleChange;

import lombok.RequiredArgsConstructor;

/**
 * UC17/UC21: dựng lại "đổi từ slot nào sang slot nào" cho các lần đổi lịch đã thành công.
 * reschedule_request chỉ lưu slot mới; slot cũ của lần đổi đầu là các dòng booking_slot gốc
 * (reschedule_request_id IS NULL, mỗi dòng 30 phút), của lần đổi sau là slot mới của lần đổi trước.
 */
@Repository
@RequiredArgsConstructor
public class RescheduleHistoryQuery {

    private final JdbcTemplate jdbc;

    /** Các lần đổi lịch thành công theo từng booking, cũ trước mới sau. */
    public Map<Long, List<RescheduleChange>> byBookingIds(Collection<Long> bookingIds) {
        if (bookingIds == null || bookingIds.isEmpty()) return Map.of();
        return load("b.id", bookingIds, false);
    }

    /** Các lần đổi lịch thành công của mọi buổi trong từng gói/đơn, theo thứ tự thời điểm đổi. */
    public Map<Long, List<RescheduleChange>> byPackageIds(Collection<Long> packageIds) {
        if (packageIds == null || packageIds.isEmpty()) return Map.of();
        return load("b.package_id", packageIds, true);
    }

    private record Range(String courtName, LocalDate date, int start, int end) {}

    private Map<Long, List<RescheduleChange>> load(String keyColumn, Collection<Long> ids, boolean byPackage) {
        String in = String.join(",", Collections.nCopies(ids.size(), "?"));
        Object[] args = ids.toArray();

        Map<Long, Range> original = new HashMap<>();
        jdbc.query("""
                SELECT s.booking_id, c.name AS court_name, s.slot_date,
                       MIN(s.slot_start_minute) AS start_minute, MAX(s.slot_start_minute) AS last_minute
                FROM booking_slot s
                JOIN booking b ON b.id = s.booking_id
                JOIN court c ON c.id = s.court_id
                WHERE s.reschedule_request_id IS NULL AND %s IN (%s)
                GROUP BY s.booking_id, c.name, s.slot_date
                """.formatted(keyColumn, in),
                rs -> {
                    original.put(rs.getLong("booking_id"), new Range(rs.getString("court_name"),
                            rs.getDate("slot_date").toLocalDate(), rs.getInt("start_minute"),
                            rs.getInt("last_minute") + MinuteTime.SLOT_MINUTES));
                }, args);

        Map<Long, Range> previous = new HashMap<>(original);
        Map<Long, List<RescheduleChange>> result = new LinkedHashMap<>();
        jdbc.query("""
                SELECT r.booking_id, b.package_id, b.booking_code, c.name AS court_name, r.new_date,
                       r.new_start_minute, r.new_end_minute, r.decided_at
                FROM reschedule_request r
                JOIN booking b ON b.id = r.booking_id
                JOIN court c ON c.id = r.new_court_id
                WHERE r.status = 'APPROVED' AND %s IN (%s)
                ORDER BY r.decided_at, r.id
                """.formatted(keyColumn, in),
                rs -> {
                    long bookingId = rs.getLong("booking_id");
                    Range to = new Range(rs.getString("court_name"), rs.getDate("new_date").toLocalDate(),
                            rs.getInt("new_start_minute"), rs.getInt("new_end_minute"));
                    Range from = previous.put(bookingId, to);
                    Timestamp decidedAt = rs.getTimestamp("decided_at");
                    long key = byPackage ? rs.getLong("package_id") : bookingId;
                    result.computeIfAbsent(key, k -> new ArrayList<>()).add(new RescheduleChange(
                            bookingId, rs.getString("booking_code"),
                            from == null ? null : from.courtName(), from == null ? null : from.date(),
                            from == null ? null : MinuteTime.format(from.start()),
                            from == null ? null : MinuteTime.format(from.end()),
                            to.courtName(), to.date(), MinuteTime.format(to.start()), MinuteTime.format(to.end()),
                            decidedAt == null ? null : decidedAt.toLocalDateTime()));
                }, args);
        return result;
    }
}
