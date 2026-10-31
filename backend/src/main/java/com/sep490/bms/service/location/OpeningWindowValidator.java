package com.sep490.bms.service.location;

import com.sep490.bms.dto.location.OpeningTime;
import com.sep490.bms.exception.AppException;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Kiểm tra khung giờ mở cửa dùng chung cho opening_hour và opening_exception.
 *
 * Ràng buộc sao đúng theo CHECK trong BMS_database.sql để API trả 400 dễ đọc
 * thay vì để SQL Server ném lỗi ràng buộc.
 */
final class OpeningWindowValidator {

    private OpeningWindowValidator() {
    }

    /** Nhận số phút, hoặc chuỗi "HH:mm" nếu số phút không được gửi. */
    static int resolveMinute(Integer minute, String time, String label) {
        if (minute != null) {
            return minute;
        }
        Integer parsed = OpeningTime.toMinute(time);
        if (parsed == null) {
            throw new AppException(label + " không hợp lệ, gửi openMinute/closeMinute hoặc openTime/closeTime dạng HH:mm");
        }
        return parsed;
    }

    /** ck_ohour_minute + ck_ohour_time (opening_exception dùng ràng buộc tương đương). */
    static void validate(int open, int close) {
        validateWindow(open, close, "Giờ mở cửa", "Giờ đóng cửa");
    }

    /**
     * Cùng bộ ràng buộc nhưng cho phép đổi nhãn, dùng lại được cho price_rule
     * (ck_price_minute + ck_price_time) với nhãn "Giờ bắt đầu" / "Giờ kết thúc".
     */
    static void validateWindow(int start, int end, String startLabel, String endLabel) {
        if (start < 0 || start > 1410) {
            throw new AppException(startLabel + " phải nằm trong khoảng 00:00 – 23:30");
        }
        if (start % OpeningTime.SLOT_STEP != 0) {
            throw new AppException(startLabel + " phải là bội số của 30 phút");
        }
        if (end < 30 || end > OpeningTime.DAY_MINUTES) {
            throw new AppException(endLabel + " phải nằm trong khoảng 00:30 – 24:00");
        }
        if (end % OpeningTime.SLOT_STEP != 0) {
            throw new AppException(endLabel + " phải là bội số của 30 phút");
        }
        if (end <= start) {
            throw new AppException(endLabel + " phải sau " + lowerFirst(startLabel));
        }
    }

    private static String lowerFirst(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        return Character.toLowerCase(value.charAt(0)) + value.substring(1);
    }
}
