package com.sep490.bms.entity.enums;

public enum PackageType {
    RECURRING,
    CUSTOM,
    /**
     * Đơn đặt lẻ (BR64, D164): nhiều dải slot trong một ngày, một địa điểm, thanh toán một lần. Lưu chung bảng
     * booking_package để dùng lại thanh toán, xác nhận, hết hạn và chia giảm giá của gói; không phải gói đặt
     * nhiều buổi (không có ưu đãi đặt theo lô, theo giới hạn đặt trước BR02, giữ chỗ 10 phút).
     */
    DAY
}
