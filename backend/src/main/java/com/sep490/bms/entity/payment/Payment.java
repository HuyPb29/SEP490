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

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
