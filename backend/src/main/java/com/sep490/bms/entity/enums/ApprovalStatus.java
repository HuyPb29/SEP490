package com.sep490.bms.entity.enums;

/**
 * Liệt kê các trạng thái xử lý yêu cầu cần phê duyệt.
 */
public enum ApprovalStatus {
    PENDING,
    APPROVED,
    REJECTED,
    /**
     * Người gửi tự rút yêu cầu khi còn PENDING (chưa ai duyệt).
     * Khác REJECTED: REJECTED là người có quyền từ chối, CANCELLED là người tạo rút lại.
     * Dùng cho maintenance (UC10); service_registration (UC05) cũng được phép lưu giá trị này.
     */
    CANCELLED
}
