package com.sep490.bms.dto.payment;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Positive;

/**
 * UC19 #3, #7: Staff xác nhận đã nhận đủ tiền. Chỉ nhập receivedAmount khi khách chuyển thừa (FR60, BR51);
 * để trống nghĩa là nhận đúng số phải trả.
 */
public record ConfirmPaymentRequest(
        @Positive(message = "Số tiền thực nhận phải lớn hơn 0")
        @Digits(integer = 12, fraction = 0, message = "Số tiền thực nhận phải là số nguyên, tối đa 12 chữ số")
        BigDecimal receivedAmount) {
}
