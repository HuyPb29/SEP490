package com.sep490.bms.entity.enums;

/**
 * Mô tả vòng đời booking từ giữ chỗ và thanh toán đến sử dụng, hoàn thành hoặc hủy.
 */
public enum BookingStatus {
    HOLDING,
    AWAITING_CONFIRMATION,
    RESUBMIT_REQUESTED,
    CONFIRMED,
    IN_USE,
    COMPLETED,
    PAYMENT_REJECTED,
    EXPIRED,
    CANCELLED_BY_PLAYER,
    CANCELLED_BY_FACILITY
}
