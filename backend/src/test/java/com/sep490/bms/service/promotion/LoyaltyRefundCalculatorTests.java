package com.sep490.bms.service.promotion;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

/**
 * Kiểm tra cách phân bổ và thu hồi điểm khi hoàn tiền toàn phần hoặc một phần.
 */
class LoyaltyRefundCalculatorTests {
    private BigDecimal n(long value) { return BigDecimal.valueOf(value); }
    @Test void refundDoesNotRevokeAnotherBookingsPointsThroughCombinedRounding() {
        var receipts=List.of(new LoyaltyRefundCalculator.Receipt(n(15000),1,10000),new LoyaltyRefundCalculator.Receipt(n(15000),1,10000));
        assertThat(LoyaltyRefundCalculator.points(receipts,n(30000))).isEqualTo(2);
    }
    @Test void usesTheRateOfEachHistoricalPayment() {
        var receipts=List.of(new LoyaltyRefundCalculator.Receipt(n(10000),2,5000),new LoyaltyRefundCalculator.Receipt(n(10000),1,10000));
        assertThat(LoyaltyRefundCalculator.points(receipts,n(15000))).isEqualTo(2);
        assertThat(LoyaltyRefundCalculator.points(receipts,n(20000))).isEqualTo(3);
    }
    @Test void partialRefundsAreCumulativeAndNeverExceedOriginalEarnings() {
        var receipts=List.of(new LoyaltyRefundCalculator.Receipt(n(15000),1,10000));
        assertThat(LoyaltyRefundCalculator.points(receipts,n(5000))).isZero();
        assertThat(LoyaltyRefundCalculator.points(receipts,n(10000))).isEqualTo(1);
        assertThat(LoyaltyRefundCalculator.points(receipts,n(15000))).isEqualTo(1);
        assertThat(LoyaltyRefundCalculator.points(receipts,n(50000))).isEqualTo(1);
    }
    @Test void integerAllocationPreservesExactPackagePoints() {
        int a=LoyaltyRefundCalculator.allocatedPoints(1,n(0),n(9000),n(18000));
        int b=LoyaltyRefundCalculator.allocatedPoints(1,n(9000),n(9000),n(18000));
        assertThat(a).isZero();assertThat(b).isEqualTo(1);assertThat(a+b).isEqualTo(1);
    }
}
