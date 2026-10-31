package com.sep490.bms.dto.location;

import java.util.ArrayList;
import java.util.List;

import com.sep490.bms.exception.AppException;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC09 - Chuyển đổi giữa cột price_rule.apply_days (char(7)) và danh sách thứ trong tuần.
 *
 * Quy ước schema: chuỗi 7 ký tự '0'/'1', vị trí 1 ứng với Thứ 2 ... vị trí 7 ứng với Chủ nhật
 * (ràng buộc ck_price_days: chỉ chứa 0/1 và không được toàn số 0).
 * API dùng danh sách số theo chuẩn ISO: 1 = Thứ 2 ... 7 = Chủ nhật.
 */
public final class ApplyDays {

    private static final int WEEK_LENGTH = 7;

    private ApplyDays() {
    }

    /** [1,2,3,4,5] -> "1111100". */
    public static String toMask(List<Integer> days) {
        if (days == null || days.isEmpty()) {
            throw new AppException("Phải chọn ít nhất một ngày áp dụng giá");
        }
        char[] mask = new char[WEEK_LENGTH];
        for (int i = 0; i < WEEK_LENGTH; i++) {
            mask[i] = '0';
        }
        for (Integer day : days) {
            if (day == null || day < 1 || day > WEEK_LENGTH) {
                throw new AppException("Thứ trong tuần phải nằm trong khoảng 1 (Thứ 2) – 7 (Chủ nhật)");
            }
            mask[day - 1] = '1';
        }
        return new String(mask);
    }

    /** "1111100" -> [1,2,3,4,5]. */
    public static List<Integer> toDays(String mask) {
        List<Integer> days = new ArrayList<>();
        if (mask == null) {
            return days;
        }
        for (int i = 0; i < mask.length() && i < WEEK_LENGTH; i++) {
            if (mask.charAt(i) == '1') {
                days.add(i + 1);
            }
        }
        return days;
    }

    /** "1111100" -> ["Thứ 2", ..., "Thứ 6"]. */
    public static List<String> toLabels(String mask) {
        return toDays(mask).stream().map(OpeningTime::dayName).toList();
    }

    /** Hai mặt nạ ngày có trùng ít nhất một thứ hay không. */
    public static boolean overlaps(String first, String second) {
        if (first == null || second == null) {
            return false;
        }
        int length = Math.min(first.length(), second.length());
        for (int i = 0; i < length; i++) {
            if (first.charAt(i) == '1' && second.charAt(i) == '1') {
                return true;
            }
        }
        return false;
    }
}
