package com.sep490.bms.entity.feedback;

import java.time.LocalDateTime;

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
@Table(name = "complaint")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Complaint {

    /** Loại khiếu nại đặc biệt: Owner xác nhận thanh toán trễ (BR49). */
    public static final String TYPE_LATE_PAYMENT_CONFIRMATION = "LATE_PAYMENT_CONFIRMATION";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "payment_id")
    private Long paymentId;

    @Column(name = "player_id")
    private Long playerId;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    // Tập giá trị mở (PAYMENT_ISSUE, COURT_SERVICE, LATE_PAYMENT_CONFIRMATION, ...) nên giữ String.
    @Column(name = "complaint_type", nullable = false, length = 30)
    private String complaintType;

    @Column(nullable = false, length = 1000)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private ComplaintStatus status;

    @Column(name = "staff_note", length = 1000)
    private String staffNote;

    @Column(name = "handled_by")
    private Long handledBy;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private ComplaintResult result;

    @Column(name = "reject_reason", length = 500)
    private String rejectReason;

    @Column(name = "compensation_points")
    private Integer compensationPoints;

    @Column(name = "decided_by")
    private Long decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = ComplaintStatus.SUBMITTED;
        }
    }
}
