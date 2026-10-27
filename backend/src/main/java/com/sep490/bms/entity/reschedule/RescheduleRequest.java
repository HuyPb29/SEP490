package com.sep490.bms.entity.reschedule;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.RescheduleStatus;

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
@Table(name = "reschedule_request")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RescheduleRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Column(name = "new_court_id", nullable = false)
    private Long newCourtId;

    @Column(name = "new_date", nullable = false)
    private LocalDate newDate;

    @Column(name = "new_start_minute", nullable = false)
    private int newStartMinute;

    @Column(name = "new_end_minute", nullable = false)
    private int newEndMinute;

    @Column(name = "old_list_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal oldListAmount;

    @Column(name = "new_list_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal newListAmount;

    @Column(name = "extra_amount", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal extraAmount = BigDecimal.ZERO;

    @Column(name = "is_free", nullable = false)
    private boolean free;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private RescheduleStatus status;

    @Column(name = "hold_expires_at")
    private LocalDateTime holdExpiresAt;

    @Column(name = "approve_deadline")
    private LocalDateTime approveDeadline;

    @Version
    @Column(nullable = false)
    private int version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
