package com.sep490.bms.service.promotion;
import java.math.BigDecimal;
import java.util.*;

/** Mỗi mốc chi tiêu chỉ thưởng một lần, kể cả mốc cao nhất. */
public final class MonetaryMilestones {
    private MonetaryMilestones() {}
    public static List<BigDecimal> due(BigDecimal total,BigDecimal threshold,List<BigDecimal> issued) {
        if(threshold.signum()<=0) throw new IllegalArgumentException("Milestone must be positive");
        return issued.isEmpty() && total.compareTo(threshold) >= 0 ? List.of(threshold) : List.of();
    }
}
