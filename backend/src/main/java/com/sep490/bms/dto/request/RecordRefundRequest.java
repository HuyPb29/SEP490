package com.sep490.bms.dto.request;

import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.validation.constraints.*;

/**
 * Nhận số tiền thực hoàn, ngày hoàn, lý do và ghi chú để ghi nhận khoản hoàn.
 */
public record RecordRefundRequest(@NotNull @DecimalMin("1") @Digits(integer=12, fraction=0) BigDecimal amount,
        @NotNull @PastOrPresent LocalDate refundDate, @Size(max=500) String reason, @Size(max=500) String note) {}
