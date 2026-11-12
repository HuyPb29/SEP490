package com.sep490.bms.dto.promotion;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
/**
 * Nhận ngưỡng chi tiêu và cấu hình voucher thưởng để tạo mốc tích lũy.
 */
public record LoyaltyMilestoneRequest(@NotNull @DecimalMin("1") @Digits(integer=14,fraction=0) BigDecimal milestoneAmount,
 @NotBlank @Size(max=100) String name, @NotNull @DecimalMin("1") @Digits(integer=12,fraction=0) BigDecimal rewardValue,
 @NotNull @Min(1) @Max(3650) Integer voucherValidDays) {}
