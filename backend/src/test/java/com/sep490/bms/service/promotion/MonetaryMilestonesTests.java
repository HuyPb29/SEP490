package com.sep490.bms.service.promotion;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class MonetaryMilestonesTests {
    private BigDecimal n(long value) { return BigDecimal.valueOf(value); }
    @Test void highestMilestoneRepeatsAtItsExactMultiples() {
        assertThat(MonetaryMilestones.due(n(15000000),n(5000000),true,List.of())).containsExactly(n(5000000),n(10000000),n(15000000));
    }
    @Test void lowerMilestonesAreAwardedOnlyOnce() {
        assertThat(MonetaryMilestones.due(n(15000000),n(1000000),false,List.of())).containsExactly(n(1000000));
    }
    @Test void refundThenCrossingTheSameAmountDoesNotReissueReward() {
        assertThat(MonetaryMilestones.due(n(11000000),n(5000000),true,List.of(n(5000000),n(10000000)))).isEmpty();
    }
    @Test void newlyAddedOrLoweredThresholdIsGrantedAtNextPayment() {
        assertThat(MonetaryMilestones.due(n(6000000),n(3000000),true,List.of(n(5000000)))).containsExactly(n(3000000),n(6000000));
    }
    @Test void databaseAndRequestDecimalScalesDoNotDuplicateReward() {
        assertThat(MonetaryMilestones.due(new BigDecimal("10000.0"),n(10000),true,List.of(new BigDecimal("10000.00")))).isEmpty();
    }
}
