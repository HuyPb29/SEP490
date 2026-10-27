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
public class RejectComplaintRequest {

    @NotBlank(message = "Lý do từ chối không được để trống")
    @Size(max = 500, message = "Lý do tối đa 500 ký tự")
    private String reason;
}
