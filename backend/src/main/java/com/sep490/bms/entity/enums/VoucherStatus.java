package com.sep490.bms.entity.enums;

/**
 * Mô tả vòng đời voucher từ bản nháp đến công bố, hết hạn hoặc vô hiệu hóa.
 */
public enum VoucherStatus {
    DRAFT,
    PUBLISHED,
    DISABLED,
    /**
     * Voucher đã quá valid_to. Do job UC37 tự chuyển từ PUBLISHED sang, không phải
     * người dùng đặt. Vẫn sửa được ngày hiệu lực để gia hạn; khi ngày mới còn hiệu lực
     * thì VoucherService.update tự đưa về PUBLISHED.
     */
    EXPIRED
}
