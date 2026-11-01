package com.sep490.bms.dto.feedback;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateComplaintRequest {

    /** Bắt buộc với Player; Staff có thể chỉ gửi paymentId. */
    private Long bookingId;

    /** Bắt buộc với loại LATE_PAYMENT_CONFIRMATION. */
    private Long paymentId;

    @NotBlank(message = "Loại khiếu nại không được để trống")
    private String complaintType;

    @NotBlank(message = "Nội dung khiếu nại không được để trống")
    @Size(max = 1000, message = "Nội dung tối đa 1000 ký tự")
    private String content;
}
