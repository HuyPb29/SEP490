package com.sep490.bms.dto.request;

import jakarta.validation.constraints.*;

public record OwnerCancellationRequest(@NotNull Cause cause, @NotBlank @Size(max=500) String reason) {
    public enum Cause { OWNER_CANCELLED, WALK_IN_CUSTOMER_REQUEST }
}
