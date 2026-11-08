package com.sep490.bms.dto.payment;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * UC20 #2–#4, FR61: Staff nhập số tiền thực nhận của ngày (sao kê ngân hàng cộng tiền mặt) và lý do nếu lệch.
 * Bắt buộc gửi date, để đối soát mở lúc 23:59 mà bấm lưu sau 0 giờ vẫn ghi đúng ngày đang xem.
 */
public record ReconciliationRequest(
        @NotNull(message = "Vui lòng chọn ngày đối soát")
        LocalDate date,

        @NotNull(message = "Vui lòng nhập số tiền thực nhận")
        @PositiveOrZero(message = "Số tiền thực nhận không được âm")
        @Digits(integer = 12, fraction = 0, message = "Số tiền thực nhận phải là số nguyên, tối đa 12 chữ số")
        BigDecimal actualAmount,

        @Size(max = 500, message = "Lý do tối đa 500 ký tự")
        String reason) {
}
