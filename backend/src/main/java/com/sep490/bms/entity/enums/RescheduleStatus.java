package com.sep490.bms.entity.enums;

/**
 * Liệt kê trạng thái chờ trả thêm, chờ xác nhận và kết quả của yêu cầu đổi lịch.
 */
public enum RescheduleStatus {
    PENDING_PAYMENT,
    AWAITING_CONFIRMATION,
    APPROVED,
    REJECTED,
    EXPIRED
}
