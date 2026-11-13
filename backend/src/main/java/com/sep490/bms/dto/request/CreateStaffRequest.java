package com.sep490.bms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Nhận tên đăng nhập, họ tên và mật khẩu ban đầu của Staff.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateStaffRequest {

    @NotBlank(message = "Họ và tên không được để trống")
    @Size(min = 2, max = 50)
    @Pattern(regexp = ValidationRules.NAME, message = "Họ tên chỉ được chứa chữ và khoảng trắng")
    private String fullName;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Pattern(regexp = ValidationRules.PASSWORD, message = ValidationRules.PASSWORD_MESSAGE)
    private String password;

    @NotBlank(message = "Tên đăng nhập không được để trống")
    @Pattern(regexp = ValidationRules.USERNAME, message = ValidationRules.USERNAME_MESSAGE)
    private String username;


}
