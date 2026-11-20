package com.sep490.bms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import lombok.*;

/**
 * Nhận mật khẩu hiện tại và mật khẩu mới của người dùng đã đăng nhập.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChangePasswordRequest {
    @NotBlank(message = "Vui lòng nhập mật khẩu hiện tại") private String currentPassword;
    @NotBlank(message = "Vui lòng nhập mật khẩu mới")
    @Pattern(regexp = ValidationRules.PASSWORD, message = "Mật khẩu mới phải có 8–32 ký tự, có chữ và số, không chứa khoảng trắng")
    private String newPassword;
}
