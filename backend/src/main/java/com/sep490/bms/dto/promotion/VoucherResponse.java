package com.sep490.bms.dto.promotion;
import java.math.BigDecimal;
import java.time.LocalDate;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.promotion.Voucher;
public record VoucherResponse(Long id, Long locationId, String code, String name, VoucherSource source,
        VoucherTargetGroup targetGroup, DiscountType discountType, BigDecimal discountValue, BigDecimal minOrderAmount,
        LocalDate validFrom, LocalDate validTo, Integer grantValidDays, Integer maxUsesPerPlayer,
        Integer maxTotalUses, int usedCount, BigDecimal budget, BigDecimal budgetUsed, VoucherStatus status, int version) {
    public static VoucherResponse from(Voucher v) {
        return new VoucherResponse(v.getId(),v.getLocationId(),v.getCode(),v.getName(),v.getSource(),v.getTargetGroup(),
                v.getDiscountType(),v.getDiscountValue(),v.getMinOrderAmount(),v.getValidFrom(),v.getValidTo(),
                v.getGrantValidDays(),v.getMaxUsesPerPlayer(),v.getMaxTotalUses(),v.getUsedCount(),v.getBudget(),v.getBudgetUsed(),v.getStatus(),v.getVersion());
    }
}
