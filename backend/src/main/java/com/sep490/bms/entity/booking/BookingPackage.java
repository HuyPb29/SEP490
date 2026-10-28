package com.sep490.bms.entity.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.PackageType;

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
@Table(name = "booking_package")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingPackage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "player_id", nullable = false)
    private Long playerId;

    @Column(name = "batch_offer_id")
    private Long batchOfferId;

    @Enumerated(EnumType.STRING)
    @Column(name = "package_type", nullable = false, length = 10)
    private PackageType packageType;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

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
