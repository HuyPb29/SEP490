package com.sep490.bms.common;

import com.sep490.bms.exception.AppException;

/**
 * Giờ trong ngày lưu bằng số phút từ 0 giờ (06:00 = 360, 24:00 = 1440), bội số 30 (FR19).
 * Lưu bằng số phút vì kiểu TIME không lưu được 24:00.
 */
public final class MinuteTime {

    /** Độ dài một slot (FR19). */
    public static final int SLOT_MINUTES = 30;
    public static final int DAY_MINUTES = 1440;

    private MinuteTime() {
    }

    /** 360 → "06:00"; 1440 → "24:00". */
    public static String format(int minute) {
        return String.format("%02d:%02d", minute / 60, minute % 60);
    }

    /** "06:00" → 360. Sai định dạng hoặc không tròn 30 phút thì báo lỗi. */
    public static int parse(String hhmm) {
        if (hhmm == null || !hhmm.matches("\\d{2}:\\d{2}")) {
            throw new AppException("Giờ phải có dạng HH:mm");
        }
        int minute = Integer.parseInt(hhmm.substring(0, 2)) * 60 + Integer.parseInt(hhmm.substring(3));
        if (!isSlotBoundary(minute)) {
            throw new AppException("Giờ phải tròn :00 hoặc :30");
        }
        return minute;
    }

    /** Mốc hợp lệ để bắt đầu hoặc kết thúc slot: 0–1440 và chia hết cho 30. */
    public static boolean isSlotBoundary(int minute) {
        return minute >= 0 && minute <= DAY_MINUTES && minute % SLOT_MINUTES == 0;
    }
}
