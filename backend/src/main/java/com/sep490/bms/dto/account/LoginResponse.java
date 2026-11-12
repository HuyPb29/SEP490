package com.sep490.bms.dto.account;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Trả token xác thực và thông tin người dùng sau khi đăng nhập hoặc xác minh đăng ký.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginResponse {

    private String token;
    @Builder.Default
    private String tokenType = "Bearer";
    private UserDto user;
}
