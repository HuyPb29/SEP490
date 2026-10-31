package com.sep490.bms.entity.promotion;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.DiscountType;
import com.sep490.bms.entity.enums.VoucherSource;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.enums.VoucherTargetGroup;

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
@Table(name = "voucher")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Voucher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(length = 20)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VoucherSource source;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_group", nullable = false, length = 15)
    private VoucherTargetGroup targetGroup;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false, length = 10)
    private DiscountType discountType;

    @Column(name = "discount_value", nullable = false, precision = 12, scale = 0)
    private BigDecimal discountValue;

    @Column(name = "min_order_amount", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal minOrderAmount = BigDecimal.ZERO;

    @Column(name = "valid_from")
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    @Column(name = "grant_valid_days")
    private Integer grantValidDays;

    @Column(name = "max_uses_per_player")
    private Integer maxUsesPerPlayer;

    @Column(name = "max_total_uses")
    private Integer maxTotalUses;

    @Column(name = "used_count", nullable = false)
    private int usedCount;

    @Column(precision = 12, scale = 0)
    private BigDecimal budget;

    @Column(name = "budget_used", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal budgetUsed = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private VoucherStatus status = VoucherStatus.DRAFT;

    @Column(name = "disabled_by")
    private Long disabledBy;

    @Column(name="allow_points",nullable=false)
    private boolean allowPoints;

    @Column(name="max_point_percent")
    private Integer maxPointPercent;

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
