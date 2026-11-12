package com.sep490.bms.dto.account;

/**
 * Trả email, tên đăng nhập và thông báo sau khi tạo yêu cầu xác minh đăng ký.
 */
public record RegistrationResponse(String email, String username, String message) {
}
