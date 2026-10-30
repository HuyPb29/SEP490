package com.sep490.bms.dto.promotion;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
public record LoyaltyMilestoneRequest(@NotNull @Min(1) @Max(100000) Integer sessionThreshold,
 @NotBlank @Size(max=100) String name, @NotNull @DecimalMin("1") @Digits(integer=12,fraction=0) BigDecimal rewardValue,
 @NotNull @Min(1) @Max(3650) Integer voucherValidDays) {}
