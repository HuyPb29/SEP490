package com.sep490.bms.entity.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.BookingType;

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
@Table(name = "booking")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_code", nullable = false, length = 20)
    private String bookingCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "booking_type", nullable = false, length = 10)
    private BookingType bookingType;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "court_id", nullable = false)
    private Long courtId;

    @Column(name = "player_id")
    private Long playerId;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "package_id")
    private Long packageId;

    @Column(name = "staff_id")
    private Long staffId;

    @Column(name = "customer_name", length = 50)
    private String customerName;

    @Column(name = "customer_phone", length = 10)
    private String customerPhone;

    @Column(name = "play_date", nullable = false)
    private LocalDate playDate;

    @Column(name = "start_minute", nullable = false)
    private int startMinute;

    @Column(name = "end_minute", nullable = false)
    private int endMinute;

    @Column(length = 200)
    private String note;

    @Column(name = "list_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal listAmount;

    @Column(name = "voucher_discount", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal voucherDiscount = BigDecimal.ZERO;

    @Column(name = "points_used", nullable = false)
    private int pointsUsed;

    @Column(name = "point_discount", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal pointDiscount = BigDecimal.ZERO;

    @Column(name = "final_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal finalAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private BookingStatus status = BookingStatus.HOLDING;

    @Column(name = "hold_expires_at")
    private LocalDateTime holdExpiresAt;

    @Column(name = "reschedule_count", nullable = false)
    private int rescheduleCount;

    @Column(name = "cancelled_by")
    private Long cancelledBy;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name="loyalty_refund_processed",nullable=false)
    private boolean loyaltyRefundProcessed;

    @Column(name="loyalty_compensation_processed",nullable=false)
    private boolean loyaltyCompensationProcessed;

    @Version
    @Column(nullable = false)
    private int version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
