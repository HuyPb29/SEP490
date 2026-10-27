package com.sep490.bms.entity.reschedule;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.RefundStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "refund_request")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Column(name = "affected_booking_id")
    private Long affectedBookingId;

    @Column(name = "complaint_id")
    private Long complaintId;

    @Column(name = "suggested_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal suggestedAmount;

    @Column(name = "refunded_amount", precision = 12, scale = 0)
    private BigDecimal refundedAmount;

    @Column(name = "refund_date")
    private LocalDate refundDate;

    @Column(name = "original_payment_date", nullable = false)
    private LocalDate originalPaymentDate;

    @Column(length = 500)
    private String reason;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private RefundStatus status = RefundStatus.PENDING_REFUND;

    @Column(name = "recorded_by")
    private Long recordedBy;

    @Column(name = "recorded_at")
    private LocalDateTime recordedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
