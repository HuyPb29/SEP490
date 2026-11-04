package com.sep490.bms.entity.payment;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.PaymentStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "payment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    /** Số lần gửi lại chứng từ tối đa (BR34, P06): cố định (D154), database chặn bằng ck_payment_resubmit. */
    public static final int MAX_RESUBMITS = 3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "package_id")
    private Long packageId;

    @Column(name = "reschedule_request_id")
    private Long rescheduleRequestId;

    @Column(name = "amount_due", nullable = false, precision = 12, scale = 0)
    private BigDecimal amountDue;

    @Column(name = "received_amount", precision = 12, scale = 0)
    private BigDecimal receivedAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private PaymentStatus status = PaymentStatus.AWAITING_CONFIRMATION;

    @Column(name = "resubmit_count", nullable = false)
    private int resubmitCount;

    @Column(name = "resubmit_reason", length = 255)
    private String resubmitReason;

    @Column(name = "resubmit_deadline")
    private LocalDateTime resubmitDeadline;

    @Column(name = "reject_reason", length = 255)
    private String rejectReason;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "confirmed_by")
    private Long confirmedBy;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "receipt_no", length = 20)
    private String receiptNo;

    @Version
    @Column(nullable = false)
    private int version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * Player đã gửi lại chứng từ (UC18 #4): chờ Staff xem lại. Tính lại thời điểm gửi để
     * mốc chậm xác nhận (BR58, P24) bắt đầu từ lần gửi này.
     */
    public void resubmitted(LocalDateTime now) {
        this.status = PaymentStatus.AWAITING_CONFIRMATION;
        this.submittedAt = now;
    }

    /**
     * Staff (hoặc Owner) xác nhận tiền đã về đủ (UC19 #3, #6, #7). Doanh thu vẫn là amountDue (BR37);
     * receivedAmount chỉ khác amountDue khi khách chuyển thừa (BR51).
     */
    public void confirm(Long staffId, BigDecimal receivedAmount, String receiptNo, LocalDateTime now) {
        this.status = PaymentStatus.CONFIRMED;
        this.confirmedBy = staffId;
        this.receivedAmount = receivedAmount;
        this.receiptNo = receiptNo;
        this.confirmedAt = now;
    }

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
