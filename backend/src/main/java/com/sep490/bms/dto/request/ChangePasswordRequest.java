package com.sep490.bms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import lombok.*;

/**
 * Nhận mật khẩu hiện tại và mật khẩu mới của người dùng đã đăng nhập.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChangePasswordRequest {
    @NotBlank private String currentPassword;
    @NotBlank
    @Pattern(regexp = ValidationRules.PASSWORD, message = ValidationRules.PASSWORD_MESSAGE)
    private String newPassword;
}
