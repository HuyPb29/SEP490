package com.sep490.bms.entity.promotion;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.VoucherUsageStatus;

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
@Table(name = "voucher_usage")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoucherUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "voucher_id", nullable = false)
    private Long voucherId;

    @Column(name = "voucher_grant_id")
    private Long voucherGrantId;

    @Column(name = "player_id", nullable = false)
    private Long playerId;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "package_id")
    private Long packageId;

    @Column(name = "discount_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal discountAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private VoucherUsageStatus status = VoucherUsageStatus.USED;

    @Column(name = "used_at", nullable = false)
    private LocalDateTime usedAt;

    @Column(name = "returned_at")
    private LocalDateTime returnedAt;

    @PrePersist
    public void prePersist() {
        if (this.usedAt == null) {
            this.usedAt = LocalDateTime.now();
        }
    }
}
