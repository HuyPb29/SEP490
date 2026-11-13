package com.sep490.bms.dto.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.BookingType;
import com.sep490.bms.entity.enums.PaymentStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Chi tiết một booking cho Player (UC17 #3–5, FR35, FR51, FR52).
 * Nút Tiếp tục thanh toán (Đang giữ chỗ) đi theo id booking: GET /api/bookings/{id}/payment-instructions.
 * Nút Gửi lại chứng từ (Chờ bổ sung) đi theo paymentId: POST /api/payments/{paymentId}/resubmit.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingDetailResponse {

    private Long id;
    private String bookingCode;
    private BookingType bookingType;
    /** Có giá trị khi là một buổi trong gói; thanh toán và đếm ngược xem ở chi tiết gói. */
    private Long packageId;
    private Long teamId;
    private String teamName;

    private Long locationId;
    private String locationName;
    private String locationAddress;
    private String courtName;
    private LocalDate playDate;
    private String startTime;
    private String endTime;
    /** Ghi chú cho chủ sân, Player nhập lúc đặt (FR35). */
    private String note;

    private BigDecimal listAmount;
    private BigDecimal voucherDiscount;
    private int pointsUsed;
    private BigDecimal pointDiscount;
    private BigDecimal finalAmount;

    /** Đang giữ chỗ đã quá hạn hiện là Hết hạn (BR03). */
    private BookingStatus status;
    /** Chỉ có khi đang giữ chỗ: mốc để đếm ngược (FR52, MSG32). */
    private LocalDateTime holdExpiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime cancelledAt;

    /** Trống khi Player chưa báo thanh toán. */
    private Long paymentId;
    private PaymentStatus paymentStatus;
    /** Lý do và hạn gửi lại khi Staff yêu cầu bổ sung (MSG50). */
    private String resubmitReason;
    private LocalDateTime resubmitDeadline;
    /** Số biên nhận, có khi Staff đã xác nhận (FR57). */
    private String receiptNo;
    /** UC31: booking đã hoàn thành và chưa được đánh giá thì hiện nút Đánh giá. */
    private boolean canReview;
}
