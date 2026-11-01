package com.sep490.bms.dto.location;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Tiện ích chuyển đổi giữa "phút trong ngày" (cột *_minute trong DB)
 * và chuỗi "HH:mm" dùng ở tầng API.
 *
 * Quy ước của schema: mốc thời gian tính bằng phút từ 00:00, bước nhảy 30 phút.
 */
public final class OpeningTime {

    /** Số phút của một ngày. 24:00 được biểu diễn bằng 1440. */
    public static final int DAY_MINUTES = 1440;

    /** Bước nhảy slot cố định 30 phút (ràng buộc ck_ohour_minute / ck_oexc_minute). */
    public static final int SLOT_STEP = 30;

    private OpeningTime() {
    }

    /** 360 -> "06:00", 1440 -> "24:00". */
    public static String toTime(Integer minute) {
        if (minute == null) {
            return null;
        }
        return String.format("%02d:%02d", minute / 60, minute % 60);
    }

    /** "06:00" -> 360, "24:00" -> 1440. Trả về null nếu chuỗi không hợp lệ. */
    public static Integer toMinute(String time) {
        if (time == null || time.isBlank()) {
            return null;
        }
        String[] parts = time.trim().split(":");
        if (parts.length != 2) {
            return null;
        }
        try {
            int hour = Integer.parseInt(parts[0].trim());
            int minute = Integer.parseInt(parts[1].trim());
            if (hour < 0 || hour > 24 || minute < 0 || minute > 59) {
                return null;
            }
            return hour * 60 + minute;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** 1 -> "Thứ 2", 7 -> "Chủ nhật". */
    public static String dayName(int dayOfWeek) {
        return switch (dayOfWeek) {
            case 1 -> "Thứ 2";
            case 2 -> "Thứ 3";
            case 3 -> "Thứ 4";
            case 4 -> "Thứ 5";
            case 5 -> "Thứ 6";
            case 6 -> "Thứ 7";
            case 7 -> "Chủ nhật";
            default -> "Không hợp lệ";
        };
    }
}
