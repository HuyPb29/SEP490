package com.sep490.bms.entity.notification;

/**
 * Feature: UC37 - Automated tasks and notifications
 * Các loại thông báo do job tự động sinh ra. Cột notification.type là VARCHAR(40) nên
 * mọi hằng số ở đây phải ngắn hơn 40 ký tự.
 */
public final class NotificationType {

    /** Đơn giữ chỗ HOLDING quá hold_expires_at nên bị huỷ tự động. */
    public static final String BOOKING_HOLD_EXPIRED = "BOOKING_HOLD_EXPIRED";

    /** Kỳ hạn dịch vụ của địa điểm đã hết, địa điểm bị khoá. */
    public static final String SERVICE_TERM_EXPIRED = "SERVICE_TERM_EXPIRED";

    /** Voucher đã quá valid_to, không nên tiếp tục phát cho khách. */
    public static final String VOUCHER_EXPIRED = "VOUCHER_EXPIRED";

    private NotificationType() {
    }
}
