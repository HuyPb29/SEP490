package com.sep490.bms.dto.promotion;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import com.sep490.bms.entity.promotion.PlayerLocationBalance;
public record LoyaltyBalanceResponse(Long id, Long locationId, int pointBalance, BigDecimal totalPaid, LocalDateTime updatedAt) {
 public static LoyaltyBalanceResponse from(PlayerLocationBalance b) { return new LoyaltyBalanceResponse(b.getId(),b.getLocationId(),b.getPointBalance(),b.getTotalPaid(),b.getUpdatedAt()); }
}
