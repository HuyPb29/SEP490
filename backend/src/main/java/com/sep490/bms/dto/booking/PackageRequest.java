package com.sep490.bms.dto.booking;

import java.time.LocalDate;
import java.util.List;

import com.sep490.bms.entity.enums.PackageType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Đặt nhiều buổi (UC15 #1–3, FR40, BR27). Dùng chung cho xem trước lịch gói và tạo gói.
 * Định kỳ (RECURRING): gửi ngày bắt đầu, ngày kết thúc và mẫu hằng tuần, hệ thống sinh các buổi.
 */
public record PackageRequest(
        @NotNull PackageType packageType,
        /** Sân của gói. */
        @NotNull @Positive Long courtId,
        /** RECURRING: thời gian đặt, từ 1 đến 3 tháng tính cả ngày cuối. */
        LocalDate startDate,
        LocalDate endDate,
        /** RECURRING: mỗi dòng là một buổi cố định trong tuần (thứ + khung giờ), ít nhất 1 dòng. */
        @Valid List<WeeklySlot> weeklySlots,
        /** Đội mình làm chủ, không bắt buộc; để trống là đặt cho cá nhân (FR37, BR09). */
        @Positive Long teamId) {

    /** Một buổi trong tuần: dayOfWeek 1 = thứ Hai … 7 = Chủ nhật; giờ tính bằng số phút từ 0 giờ. */
    public record WeeklySlot(
            @NotNull @Min(1) @Max(7) Integer dayOfWeek,
            @Min(0) @Max(1410) int startMinute,
            @Min(30) @Max(1440) int endMinute) {
    }
}
