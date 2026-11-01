package com.sep490.bms.dto.promotion;
import com.sep490.bms.entity.promotion.LoyaltyTier;
public record LoyaltyMilestoneResponse(Long id, Long locationId, Integer sessionThreshold, boolean active, int version, VoucherResponse voucher) {
 public static LoyaltyMilestoneResponse from(LoyaltyTier t,VoucherResponse v) { return new LoyaltyMilestoneResponse(t.getId(),t.getLocationId(),t.getSessionThreshold(),t.isActive(),t.getVersion(),v); }
}
