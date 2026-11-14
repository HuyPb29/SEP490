package com.sep490.bms.dto.request;

import jakarta.validation.constraints.*;

/**
 * Nhận nguyên nhân và lý do Owner hủy hoặc đánh dấu booking bị ảnh hưởng.
 */
public record OwnerCancellationRequest(@NotNull Cause cause, @NotBlank @Size(max=500) String reason) {
    public enum Cause { OWNER_CANCELLED, WALK_IN_CUSTOMER_REQUEST }
}
