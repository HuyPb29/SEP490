package com.sep490.bms.dto.promotion;

import java.math.BigDecimal;
import java.time.LocalDate;
import com.sep490.bms.entity.enums.*;
import jakarta.validation.constraints.*;

/** Owner campaigns only. SPECIFIED uses grants instead of a public code. */
public record VoucherWriteRequest(
        @Size(max=20) @Pattern(regexp="[A-Za-z0-9_-]+") String code,
        @NotBlank @Size(max=100) String name,
        @NotNull VoucherTargetGroup targetGroup,
        @NotNull DiscountType discountType,
        @NotNull @DecimalMin("1") @Digits(integer=12, fraction=0) BigDecimal discountValue,
        @NotNull @DecimalMin("0") @Digits(integer=12, fraction=0) BigDecimal minOrderAmount,
        @NotNull LocalDate validFrom,
        @NotNull LocalDate validTo,
        @Min(1) @Max(3650) Integer grantValidDays,
        @Min(1) Integer maxUsesPerPlayer,
        @Min(1) Integer maxTotalUses,
        @DecimalMin("1") @Digits(integer=12, fraction=0) BigDecimal budget,
        Boolean allowPoints, @Min(1) @Max(100) Integer maxPointPercent) {
    public VoucherWriteRequest(String code, String name, VoucherTargetGroup targetGroup, DiscountType discountType,
            BigDecimal discountValue, BigDecimal minOrderAmount, LocalDate validFrom, LocalDate validTo,
            Integer grantValidDays, Integer maxUsesPerPlayer, Integer maxTotalUses, BigDecimal budget) {
        this(code,name,targetGroup,discountType,discountValue,minOrderAmount,validFrom,validTo,grantValidDays,
                maxUsesPerPlayer,maxTotalUses,budget,false,null);
    }
    @AssertTrue(message="Kết hợp điểm yêu cầu tỷ lệ tối đa 1–100%; không kết hợp thì bỏ tỷ lệ")
    public boolean isPointPolicyValid() { return Boolean.TRUE.equals(allowPoints) ? maxPointPercent!=null : maxPointPercent==null; }
    @AssertTrue(message="Ngày hết hạn phải từ ngày bắt đầu trở đi")
    public boolean isDateRangeValid() { return validFrom == null || validTo == null || !validTo.isBefore(validFrom); }
    @AssertTrue(message="SPECIFIED không có code; voucher công khai bắt buộc có code")
    public boolean isCodeValid() { return targetGroup == null || (targetGroup == VoucherTargetGroup.SPECIFIED ? code == null : code != null && !code.isBlank()); }
    @AssertTrue(message="Phần trăm giảm từ 1 đến 99")
    public boolean isPercentageValid() { return discountType != DiscountType.PERCENT || discountValue == null || discountValue.compareTo(BigDecimal.valueOf(99)) <= 0; }
}
