package com.sep490.bms.dto.promotion;
import jakarta.validation.constraints.*;
public record VoucherSelection(@Size(max=20) String code, @Positive Long grantId) {
    @AssertTrue(message="Chọn đúng một code hoặc grantId")
    public boolean isSelectionValid() { return (code != null && !code.isBlank()) != (grantId != null); }
}
