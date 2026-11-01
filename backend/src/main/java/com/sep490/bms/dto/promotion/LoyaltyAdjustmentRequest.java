package com.sep490.bms.dto.promotion;
import jakarta.validation.constraints.*;
public record LoyaltyAdjustmentRequest(@NotNull @Positive Long bookingId, @NotNull @Positive Integer points, @NotBlank @Size(max=255) String reason) {}
