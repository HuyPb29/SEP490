package com.sep490.bms.entity.enums;

/**
 * Liệt kê trạng thái chờ xác nhận, yêu cầu bổ sung, đã xác nhận và bị từ chối của giao dịch.
 */
public enum PaymentStatus {
    AWAITING_CONFIRMATION,
    RESUBMIT_REQUESTED,
    CONFIRMED,
    REJECTED
}
