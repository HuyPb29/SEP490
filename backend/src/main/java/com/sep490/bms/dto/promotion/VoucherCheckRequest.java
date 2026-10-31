package com.sep490.bms.dto.promotion;
import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
public record VoucherCheckRequest(@NotNull @Positive Long locationId,
        @NotNull @DecimalMin("1") @Digits(integer=12,fraction=0) BigDecimal orderAmount,
        @NotNull @Valid VoucherSelection selection) {}
