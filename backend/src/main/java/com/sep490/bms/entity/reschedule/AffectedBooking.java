package com.sep490.bms.entity.reschedule;

import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.AffectedCause;
import com.sep490.bms.entity.enums.AffectedChoice;
import com.sep490.bms.entity.enums.AffectedStatus;

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
@Table(name = "affected_booking")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AffectedBooking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AffectedCause cause;

    @Column(name = "maintenance_id")
    private Long maintenanceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private AffectedStatus status = AffectedStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private AffectedChoice choice;

    @Column(name = "is_default_choice", nullable = false)
    private boolean defaultChoice;

    @Column(name = "compensation_points")
    private Integer compensationPoints;

    @Column(name = "reschedule_request_id")
    private Long rescheduleRequestId;

    @Column(name = "created_by")
    private Long createdBy;

    @Version
    @Column(nullable = false)
    private int version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "chosen_at")
    private LocalDateTime chosenAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
