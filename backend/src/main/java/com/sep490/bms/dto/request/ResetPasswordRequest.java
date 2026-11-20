package com.sep490.bms.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Nhận email, mã OTP và mật khẩu mới để hoàn tất khôi phục mật khẩu.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResetPasswordRequest {

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Định dạng email không hợp lệ")
    private String email;

    @NotBlank(message = "Mã OTP không được để trống")
    private String otp;

    @NotBlank(message = "Mật khẩu mới không được để trống")
    @Pattern(regexp = ValidationRules.PASSWORD, message = "Mật khẩu mới phải có 8–32 ký tự, có chữ và số, không chứa khoảng trắng")
    private String newPassword;
}
