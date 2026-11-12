package com.sep490.bms.dto.promotion;
import jakarta.validation.constraints.*;
/**
 * Nhận số điểm Owner cộng, mã booking liên quan và lý do điều chỉnh.
 */
public record LoyaltyAdjustmentRequest(@NotNull @Positive Long bookingId, @NotNull @Positive Integer points, @NotBlank @Size(max=255) String reason) {}
