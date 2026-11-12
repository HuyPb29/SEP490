package com.sep490.bms.entity.account;

/**
 * Liệt kê các hành động tài khoản được lưu vào nhật ký kiểm toán.
 */
public enum AccountAuditAction {
    REGISTER_VERIFIED, LOGIN, LOGOUT_ALL, PROFILE_UPDATED, PASSWORD_CHANGED, PASSWORD_RESET,
    STAFF_CREATED, STAFF_PASSWORD_RESET, STAFF_STATUS_CHANGED, ACCOUNT_STATUS_CHANGED
}
