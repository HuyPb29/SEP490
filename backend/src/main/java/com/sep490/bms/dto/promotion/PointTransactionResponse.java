package com.sep490.bms.dto.promotion;
import java.time.LocalDateTime;
import com.sep490.bms.entity.enums.PointTransactionType;
import com.sep490.bms.entity.promotion.PointTransaction;
public record PointTransactionResponse(Long id, Long balanceId, Long bookingId, Long packageId, PointTransactionType type, int points, int balanceAfter, Integer earningRate, String reason, Long createdBy, LocalDateTime createdAt) {
 public static PointTransactionResponse from(PointTransaction t) { return new PointTransactionResponse(t.getId(),t.getBalanceId(),t.getBookingId(),t.getPackageId(),t.getType(),t.getPoints(),t.getBalanceAfter(),t.getEarningRate(),t.getReason(),t.getCreatedBy(),t.getCreatedAt()); }
}
