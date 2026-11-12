package com.sep490.bms.dto.promotion;
import com.sep490.bms.entity.promotion.LoyaltyTier;
/**
 * Trả ngưỡng chi tiêu, voucher thưởng, phiên bản và trạng thái của mốc tích lũy.
 */
public record LoyaltyMilestoneResponse(Long id, Long locationId, java.math.BigDecimal milestoneAmount, boolean active, int version, VoucherResponse voucher) {
 public static LoyaltyMilestoneResponse from(LoyaltyTier t,VoucherResponse v) { return new LoyaltyMilestoneResponse(t.getId(),t.getLocationId(),t.getMilestoneAmount(),t.isActive(),t.getVersion(),v); }
}
