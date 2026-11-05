package com.sep490.bms.dto.payment;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.payment.Payment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Trạng thái thanh toán của một booking (UC18 #3–5). Có biên nhận (receiptNo) khi Staff đã xác nhận (FR57).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentResponse {

    private Long id;
    private Long bookingId;
    private String bookingCode;
    private BigDecimal amountDue;
    /** Số tiền Staff ghi nhận khi xác nhận; trống khi chưa xác nhận. */
    private BigDecimal receivedAmount;
    private PaymentStatus status;
    /** Lý do và hạn gửi lại khi Staff yêu cầu bổ sung (MSG50). */
    private String resubmitReason;
    private LocalDateTime resubmitDeadline;
    /** Số lần gửi lại chứng từ còn được tính (BR34, P06). */
    private int resubmitsLeft;
    private String rejectReason;
    private LocalDateTime submittedAt;
    private LocalDateTime confirmedAt;
    private String receiptNo;

    public static PaymentResponse from(Payment payment, Booking booking) {
        return PaymentResponse.builder()
                .id(payment.getId())
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .amountDue(payment.getAmountDue())
                .receivedAmount(payment.getReceivedAmount())
                .status(payment.getStatus())
                .resubmitReason(payment.getResubmitReason())
                .resubmitDeadline(payment.getResubmitDeadline())
                .resubmitsLeft(Payment.MAX_RESUBMITS - payment.getResubmitCount())
                .rejectReason(payment.getRejectReason())
                .submittedAt(payment.getSubmittedAt())
                .confirmedAt(payment.getConfirmedAt())
                .receiptNo(payment.getReceiptNo())
                .build();
    }
}
