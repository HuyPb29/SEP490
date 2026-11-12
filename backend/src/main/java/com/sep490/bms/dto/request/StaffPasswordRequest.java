package com.sep490.bms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import lombok.*;

/**
 * Nhận mật khẩu mới do Owner đặt lại cho tài khoản Staff.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StaffPasswordRequest {
    @NotBlank
    @Pattern(regexp = ValidationRules.PASSWORD, message = ValidationRules.PASSWORD_MESSAGE)
    private String newPassword;
}
