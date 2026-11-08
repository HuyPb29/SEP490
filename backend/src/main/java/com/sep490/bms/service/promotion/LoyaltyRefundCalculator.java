package com.sep490.bms.service.promotion;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** Refunds follow the original payment receipts, including each receipt's rounding and earning rate. */
public final class LoyaltyRefundCalculator {
    private LoyaltyRefundCalculator() {}
    public record Receipt(BigDecimal amount, int earnedPoints, int rate) {}

    public static int points(List<Receipt> receipts, BigDecimal refunded) {
        if(refunded.signum()<0) throw new IllegalArgumentException("Negative refund");
        int result=0;
        BigDecimal remaining=refunded;
        for(Receipt receipt:receipts) {
            BigDecimal part=remaining.min(receipt.amount());
            if(part.signum()>0) {
                int points=part.compareTo(receipt.amount())==0 ? receipt.earnedPoints()
                        : part.divideToIntegralValue(BigDecimal.valueOf(receipt.rate())).min(BigDecimal.valueOf(receipt.earnedPoints())).intValueExact();
                result=Math.addExact(result,points);
                remaining=remaining.subtract(part);
            }
        }
        return result;
    }

    /** Cumulative proportional allocation preserves the exact integer total across package sessions. */
    public static int allocatedPoints(int points,BigDecimal before,BigDecimal amount,BigDecimal total) {
        if(total.signum()<=0) throw new IllegalArgumentException("Invalid package amount");
        BigDecimal n=BigDecimal.valueOf(points);
        return before.add(amount).multiply(n).divide(total,0,RoundingMode.DOWN)
                .subtract(before.multiply(n).divide(total,0,RoundingMode.DOWN)).intValueExact();
    }
}
