package com.sep490.bms.dto.payment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** UC19 #5: Staff từ chối giao dịch, bắt buộc ghi lý do để Player biết (MSG51). */
public record RejectPaymentRequest(
        @NotBlank(message = "Vui lòng nhập lý do từ chối")
        @Size(max = 255, message = "Lý do tối đa 255 ký tự")
        String reason) {
}
