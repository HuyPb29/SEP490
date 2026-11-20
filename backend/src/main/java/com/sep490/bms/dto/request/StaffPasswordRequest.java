package com.sep490.bms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import lombok.*;

/**
 * Nhận mật khẩu mới do Owner đặt lại cho tài khoản Staff.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StaffPasswordRequest {
    @NotBlank(message = "Vui lòng nhập mật khẩu mới")
    @Pattern(regexp = ValidationRules.PASSWORD, message = "Mật khẩu mới phải có 8–32 ký tự, có chữ và số, không chứa khoảng trắng")
    private String newPassword;
}
