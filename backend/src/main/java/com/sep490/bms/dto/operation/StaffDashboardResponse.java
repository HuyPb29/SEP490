package com.sep490.bms.dto.operation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Trả số liệu trong ngày cho Staff, gồm booking, thanh toán chờ xác nhận, khiếu nại và đối soát.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StaffDashboardResponse {

    private Long locationId;
    private String locationName;
    private LocalDate date;

    /** Số booking hôm nay theo trạng thái. */
    private Map<String, Long> bookingsByStatus;
    private List<BookingItem> todayBookings;

    private long paymentsAwaitingConfirmation;
    /** Giao dịch chờ xác nhận đã gửi quá paymentOverdueMinutes phút, cần xử lý gấp. */
    private long overduePayments;
    private int paymentOverdueMinutes;
    private List<PendingPayment> pendingPayments;
    private long complaintsToForward;
    private BigDecimal todayRevenue;
    private boolean reconciledToday;

    /** Trạng thái từng sân đang hoạt động tại thời điểm xem (UC34). */
    private List<CourtItem> courts;

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class CourtItem {
        private Long courtId;
        private String courtName;
        /** AVAILABLE, IN_USE (booking đã xác nhận đang chơi), HOLDING (booking chờ thanh toán), MAINTENANCE. */
        private String status;
        /** Booking đang chiếm sân (IN_USE, HOLDING). */
        private String bookingCode;
        /** Phút trong ngày booking đang chiếm sân kết thúc. */
        private Integer untilMinute;
        /** Thời điểm bảo trì kết thúc (MAINTENANCE), có thể sang ngày khác. */
        private LocalDateTime maintenanceUntil;
        /** Booking kế tiếp trong ngày của sân, null nếu hết booking. */
        private String nextBookingCode;
        private Integer nextStartMinute;
    }

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class BookingItem {
        private Long id;
        private String bookingCode;
        private String courtName;
        private int startMinute;
        private int endMinute;
        private String customerName;
        private String customerPhone;
        private String status;
        private BigDecimal finalAmount;
    }

    public record PendingPayment(Long id, String label, BigDecimal amountDue, LocalDateTime submittedAt,
            boolean reschedule, boolean overdue) {}
}
