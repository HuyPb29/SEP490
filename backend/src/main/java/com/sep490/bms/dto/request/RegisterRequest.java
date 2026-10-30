package com.sep490.bms.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
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
public class RegisterRequest {

    public void setFullName(String fullName) {
        this.fullName = normalizeFullName(fullName);
    }

    public static String normalizeFullName(String value) {
        return value == null ? null : value.replaceAll("(?U)\\s+", " ").trim();
    }

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Định dạng email không hợp lệ")
    private String email;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^0[0-9]{9}$", message = "Số điện thoại phải gồm đúng 10 chữ số")
    private String phone;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Pattern(regexp = ValidationRules.PASSWORD, message = ValidationRules.PASSWORD_MESSAGE)
    private String password;

    @NotBlank(message = "Họ và tên không được để trống")
    @Size(min = 2, max = 50)
    @Pattern(regexp = ValidationRules.NAME, message = "Họ tên chỉ được chứa chữ và khoảng trắng")
    private String fullName;

    @NotBlank(message = "Tên đăng nhập không được để trống")
    @Pattern(regexp = "^[a-z][a-z0-9._]{3,19}$", message = "Tên đăng nhập phải gồm 4–20 ký tự và bắt đầu bằng chữ thường")
    private String username;
}
