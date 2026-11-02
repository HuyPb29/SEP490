package com.sep490.bms.dto.promotion;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
/** Changing settings requires the version returned by GET. */
public record LoyaltyMilestoneUpdateRequest(@NotNull @Min(0) Integer version, @NotNull Boolean active,
 @NotNull @Valid LoyaltyMilestoneRequest settings) {}
