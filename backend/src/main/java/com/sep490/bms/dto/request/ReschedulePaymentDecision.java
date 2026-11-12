package com.sep490.bms.dto.request;

import java.math.BigDecimal;
import jakarta.validation.constraints.*;

/**
 * Nhận số tiền thực nhận khi xác nhận phụ thu hoặc lý do từ chối giao dịch đổi lịch.
 */
public record ReschedulePaymentDecision(@DecimalMin("1") @Digits(integer=12,fraction=0) BigDecimal receivedAmount,
        @Size(max=255) String reason) {}
