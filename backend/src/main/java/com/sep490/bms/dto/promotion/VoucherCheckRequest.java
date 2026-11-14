package com.sep490.bms.dto.promotion;
import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
/**
 * Nhận địa điểm, giá trị đơn và lựa chọn voucher để tính thử ưu đãi.
 */
public record VoucherCheckRequest(@NotNull @Positive Long locationId,
        @NotNull @DecimalMin("1") @Digits(integer=12,fraction=0) BigDecimal orderAmount,
        @NotNull @Valid VoucherSelection selection) {}
