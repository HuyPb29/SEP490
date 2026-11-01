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
        if (open < 0 || open > 1410) {
            throw new AppException("Giờ mở cửa phải nằm trong khoảng 00:00 – 23:30");
        }
        if (open % OpeningTime.SLOT_STEP != 0) {
            throw new AppException("Giờ mở cửa phải là bội số của 30 phút");
        }
        if (close < 30 || close > OpeningTime.DAY_MINUTES) {
            throw new AppException("Giờ đóng cửa phải nằm trong khoảng 00:30 – 24:00");
        }
        if (close % OpeningTime.SLOT_STEP != 0) {
            throw new AppException("Giờ đóng cửa phải là bội số của 30 phút");
        }
        if (close <= open) {
            throw new AppException("Giờ đóng cửa phải sau giờ mở cửa");
        }
    }
}
