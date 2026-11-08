package com.sep490.bms.service.promotion;
import java.math.BigDecimal;
import java.util.*;

/** BR12: issue unseen reached amounts; only the highest configured milestone repeats. */
public final class MonetaryMilestones {
    private MonetaryMilestones() {}
    public static List<BigDecimal> due(BigDecimal total,BigDecimal threshold,boolean highest,List<BigDecimal> issued) {
        if(threshold.signum()<=0) throw new IllegalArgumentException("Milestone must be positive");
        Set<BigDecimal> history=new HashSet<>();issued.forEach(value->history.add(value.stripTrailingZeros()));
        List<BigDecimal> result=new ArrayList<>();
        for(BigDecimal amount=threshold;amount.compareTo(total)<=0;amount=amount.add(threshold)) {
            if(!history.contains(amount.stripTrailingZeros())) result.add(amount);
            if(!highest) break;
        }
        return result;
    }
}
