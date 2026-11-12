package com.sep490.bms.dto.payment;

import java.math.BigDecimal;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * UC19 #4, BR34: Staff yêu cầu Player bổ sung (gửi lại chứng từ hoặc chuyển thêm phần còn thiếu).
 * playerAtFault = true khi thông tin Player gửi bị sai, chỉ khi đó mới trừ một lượt gửi lại;
 * lỗi thiết bị tại quầy hoặc tiền về chậm thì chọn false.
 */
public record ResubmitRequest(
        @NotBlank(message = "Vui lòng nhập lý do yêu cầu bổ sung")
        @Size(max = 255, message = "Lý do tối đa 255 ký tự")
        String reason,
        @NotNull(message = "Vui lòng chọn lỗi có do Player hay không")
        Boolean playerAtFault,
        @DecimalMin("0") @Digits(integer = 12, fraction = 0) BigDecimal receivedAmount) {
    public ResubmitRequest(String reason, Boolean playerAtFault) {
        this(reason, playerAtFault, null);
    }
}
