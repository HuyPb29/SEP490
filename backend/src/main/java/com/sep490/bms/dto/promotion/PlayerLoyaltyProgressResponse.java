package com.sep490.bms.dto.promotion;

import java.math.BigDecimal;

/** Tiến độ cá nhân đến phần thưởng kế tiếp; không công khai cấu hình quản trị voucher. */
public record PlayerLoyaltyProgressResponse(Long locationId, BigDecimal totalPaid,
        BigDecimal nextMilestoneAmount, BigDecimal remainingAmount, String rewardName,
        BigDecimal rewardValue) {}
