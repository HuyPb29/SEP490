package com.sep490.bms.repository.operation;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** Truy vấn đọc cho vận hành và báo cáo (F9), tổng hợp trực tiếp bằng SQL theo từng địa điểm. */
@Repository
@RequiredArgsConstructor
public class OperationQueryRepository {

    private final JdbcTemplate jdbc;

    @Getter
    @AllArgsConstructor
    public static class BookingCountRow {
        private final LocalDate playDate;
        private final Long courtId;
        private final String courtName;
        private final String status;
        private final long count;
    }

    @Getter
    @AllArgsConstructor
    public static class AmountRow {
        private final LocalDate date;
        private final BigDecimal amount;
        private final long count;
    }

    @Getter
    @AllArgsConstructor
    public static class SlotRow {
        private final Long courtId;
        private final LocalDate date;
        private final long slots;
    }

    @Getter
    @AllArgsConstructor
    public static class CourtRow {
        private final Long id;
        private final String name;
    }

    /** Khung giờ mở cửa; dayOfWeek 1–7 (1 = thứ Hai) hoặc date nếu là ngoại lệ. */
    @Getter
    @AllArgsConstructor
    public static class OpeningRow {
        private final Integer dayOfWeek;
        private final LocalDate date;
        private final int openMinute;
        private final int closeMinute;
    }

    @Getter
    @AllArgsConstructor
    public static class BookingDetailRow {
        private final Long id;
        private final String bookingCode;
        private final String bookingType;
        private final String courtName;
        private final LocalDate playDate;
        private final int startMinute;
        private final int endMinute;
        private final String customerName;
        private final String customerPhone;
        private final String status;
        private final BigDecimal listAmount;
        private final BigDecimal voucherDiscount;
        private final BigDecimal pointDiscount;
        private final BigDecimal finalAmount;
    }

    public List<BookingCountRow> countBookings(Long locationId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT b.play_date, b.court_id, c.name AS court_name, b.status, COUNT(*) AS cnt
                FROM booking b JOIN court c ON c.id = b.court_id
                WHERE b.location_id = ? AND b.play_date BETWEEN ? AND ?
                GROUP BY b.play_date, b.court_id, c.name, b.status
                """,
                (rs, i) -> new BookingCountRow(rs.getDate("play_date").toLocalDate(), rs.getLong("court_id"),
                        rs.getString("court_name"), rs.getString("status"), rs.getLong("cnt")),
                locationId, java.sql.Date.valueOf(from), java.sql.Date.valueOf(to));
    }

    /** Doanh thu theo ngày xác nhận của các khoản thanh toán đã xác nhận. */
    public List<AmountRow> sumConfirmedPayments(Long locationId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT CAST(confirmed_at AS DATE) AS d,
                       SUM(COALESCE(received_amount, amount_due)) AS amount, COUNT(*) AS cnt
                FROM payment
                WHERE location_id = ? AND status = 'CONFIRMED'
                  AND confirmed_at >= ? AND confirmed_at < ?
                GROUP BY CAST(confirmed_at AS DATE)
                """,
                (rs, i) -> new AmountRow(rs.getDate("d").toLocalDate(), rs.getBigDecimal("amount"), rs.getLong("cnt")),
                locationId, Timestamp.valueOf(from.atStartOfDay()), Timestamp.valueOf(to.plusDays(1).atStartOfDay()));
    }

    /** Tiền đã hoàn theo ngày hoàn. */
    public List<AmountRow> sumRefunds(Long locationId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT refund_date AS d, SUM(refunded_amount) AS amount, COUNT(*) AS cnt
                FROM refund_request
                WHERE location_id = ? AND status = 'REFUNDED' AND refund_date BETWEEN ? AND ?
                GROUP BY refund_date
                """,
                (rs, i) -> new AmountRow(rs.getDate("d").toLocalDate(), rs.getBigDecimal("amount"), rs.getLong("cnt")),
                locationId, java.sql.Date.valueOf(from), java.sql.Date.valueOf(to));
    }

    /** Số slot 30 phút đang giữ chỗ bởi booking hợp lệ, theo sân và ngày. */
    public List<SlotRow> countBookedSlots(Long locationId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT s.court_id, s.slot_date, COUNT(*) AS cnt
                FROM booking_slot s JOIN booking b ON b.id = s.booking_id
                WHERE b.location_id = ? AND s.is_active = 1
                  AND b.status IN ('CONFIRMED','IN_USE','COMPLETED')
                  AND s.slot_date BETWEEN ? AND ?
                GROUP BY s.court_id, s.slot_date
                """,
                (rs, i) -> new SlotRow(rs.getLong("court_id"), rs.getDate("slot_date").toLocalDate(), rs.getLong("cnt")),
                locationId, java.sql.Date.valueOf(from), java.sql.Date.valueOf(to));
    }

    public List<CourtRow> findActiveCourts(Long locationId) {
        return jdbc.query("SELECT id, name FROM court WHERE location_id = ? AND is_active = 1 ORDER BY name",
                (rs, i) -> new CourtRow(rs.getLong("id"), rs.getString("name")), locationId);
    }

    public List<OpeningRow> findOpeningHours(Long locationId) {
        return jdbc.query("SELECT day_of_week, open_minute, close_minute FROM opening_hour WHERE location_id = ?",
                (rs, i) -> new OpeningRow(rs.getInt("day_of_week"), null, rs.getInt("open_minute"),
                        rs.getInt("close_minute")),
                locationId);
    }

    public List<OpeningRow> findOpeningExceptions(Long locationId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT exception_date, open_minute, close_minute FROM opening_exception
                WHERE location_id = ? AND exception_date BETWEEN ? AND ?
                """,
                (rs, i) -> new OpeningRow(null, rs.getDate("exception_date").toLocalDate(),
                        rs.getInt("open_minute"), rs.getInt("close_minute")),
                locationId, java.sql.Date.valueOf(from), java.sql.Date.valueOf(to));
    }

    /** Booking trong khoảng ngày, kèm tên khách (player hoặc khách vãng lai do Staff nhập). */
    public List<BookingDetailRow> findBookingDetails(Long locationId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT b.id, b.booking_code, b.booking_type, c.name AS court_name, b.play_date,
                       b.start_minute, b.end_minute,
                       COALESCE(a.full_name, b.customer_name) AS customer_name,
                       COALESCE(a.phone, b.customer_phone) AS customer_phone,
                       b.status, b.list_amount, b.voucher_discount, b.point_discount, b.final_amount
                FROM booking b
                JOIN court c ON c.id = b.court_id
                LEFT JOIN account a ON a.id = b.player_id
                WHERE b.location_id = ? AND b.play_date BETWEEN ? AND ?
                ORDER BY b.play_date, b.start_minute, c.name
                """,
                (rs, i) -> new BookingDetailRow(rs.getLong("id"), rs.getString("booking_code"),
                        rs.getString("booking_type"), rs.getString("court_name"),
                        rs.getDate("play_date").toLocalDate(), rs.getInt("start_minute"), rs.getInt("end_minute"),
                        rs.getString("customer_name"), rs.getString("customer_phone"), rs.getString("status"),
                        rs.getBigDecimal("list_amount"), rs.getBigDecimal("voucher_discount"),
                        rs.getBigDecimal("point_discount"), rs.getBigDecimal("final_amount")),
                locationId, java.sql.Date.valueOf(from), java.sql.Date.valueOf(to));
    }

    @Getter
    @AllArgsConstructor
    public static class CancellationRow {
        private final LocalDate playDate;
        private final String status;
        private final long count;
        private final BigDecimal amount;
    }

    @Getter
    @AllArgsConstructor
    public static class RescheduleRow {
        private final LocalDate date;
        private final String status;
        private final boolean free;
        private final long count;
        private final BigDecimal extraAmount;
    }

    @Getter
    @AllArgsConstructor
    public static class VoucherUsageRow {
        private final Long voucherId;
        private final String name;
        private final String code;
        private final String source;
        private final String status;
        private final long count;
        private final BigDecimal discount;
    }

    /** Booking đã hủy theo ngày chơi và bên hủy. */
    public List<CancellationRow> countCancellations(Long locationId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT play_date, status, COUNT(*) AS cnt, SUM(final_amount) AS amount
                FROM booking
                WHERE location_id = ? AND play_date BETWEEN ? AND ?
                  AND status IN ('CANCELLED_BY_PLAYER','CANCELLED_BY_FACILITY')
                GROUP BY play_date, status
                """,
                (rs, i) -> new CancellationRow(rs.getDate("play_date").toLocalDate(), rs.getString("status"),
                        rs.getLong("cnt"), rs.getBigDecimal("amount")),
                locationId, java.sql.Date.valueOf(from), java.sql.Date.valueOf(to));
    }

    /** Số yêu cầu hoàn tiền tạo trong kỳ và tổng tiền đã hoàn (nếu có) của chúng. */
    public AmountRow sumRefundRequests(Long locationId, LocalDate from, LocalDate to) {
        return jdbc.queryForObject("""
                SELECT COUNT(*) AS cnt, COALESCE(SUM(refunded_amount), 0) AS amount
                FROM refund_request
                WHERE location_id = ? AND created_at >= ? AND created_at < ?
                """,
                (rs, i) -> new AmountRow(null, rs.getBigDecimal("amount"), rs.getLong("cnt")),
                locationId, Timestamp.valueOf(from.atStartOfDay()), Timestamp.valueOf(to.plusDays(1).atStartOfDay()));
    }

    /** Yêu cầu đổi lịch tạo trong kỳ, theo ngày tạo, trạng thái và miễn phí hay không. */
    public List<RescheduleRow> countReschedules(Long locationId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT CAST(r.created_at AS DATE) AS d, r.status, r.is_free,
                       COUNT(*) AS cnt, SUM(r.extra_amount) AS extra
                FROM reschedule_request r JOIN booking b ON b.id = r.booking_id
                WHERE b.location_id = ? AND r.created_at >= ? AND r.created_at < ?
                GROUP BY CAST(r.created_at AS DATE), r.status, r.is_free
                """,
                (rs, i) -> new RescheduleRow(rs.getDate("d").toLocalDate(), rs.getString("status"),
                        rs.getBoolean("is_free"), rs.getLong("cnt"), rs.getBigDecimal("extra")),
                locationId, Timestamp.valueOf(from.atStartOfDay()), Timestamp.valueOf(to.plusDays(1).atStartOfDay()));
    }

    /** Lượt dùng voucher của địa điểm trong kỳ, theo từng voucher và trạng thái lượt dùng. */
    public List<VoucherUsageRow> countVoucherUsages(Long locationId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT v.id, v.name, v.code, v.source, u.status, COUNT(*) AS cnt,
                       SUM(u.discount_amount) AS discount
                FROM voucher_usage u JOIN voucher v ON v.id = u.voucher_id
                WHERE v.location_id = ? AND u.used_at >= ? AND u.used_at < ?
                GROUP BY v.id, v.name, v.code, v.source, u.status
                ORDER BY v.name
                """,
                (rs, i) -> new VoucherUsageRow(rs.getLong("id"), rs.getString("name"), rs.getString("code"),
                        rs.getString("source"), rs.getString("status"), rs.getLong("cnt"),
                        rs.getBigDecimal("discount")),
                locationId, Timestamp.valueOf(from.atStartOfDay()), Timestamp.valueOf(to.plusDays(1).atStartOfDay()));
    }

    public long countPaymentsAwaitingConfirmation(Long locationId) {
        Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM payment WHERE location_id = ? AND status = 'AWAITING_CONFIRMATION'",
                Long.class, locationId);
        return n == null ? 0 : n;
    }

    public long countComplaintsByStatus(Long locationId, String status) {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM complaint WHERE location_id = ? AND status = ?",
                Long.class, locationId, status);
        return n == null ? 0 : n;
    }

    public boolean existsReconciliation(Long locationId, LocalDate date) {
        Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM reconciliation WHERE location_id = ? AND recon_date = ?",
                Long.class, locationId, java.sql.Date.valueOf(date));
        return n != null && n > 0;
    }
}
