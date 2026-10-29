package com.sep490.bms.dto.promotion;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
public record VoucherUpdateRequest(@NotNull @Min(0) Integer version, @NotNull @Valid VoucherWriteRequest voucher) {}
