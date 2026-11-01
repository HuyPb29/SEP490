package com.sep490.bms.dto.location;

import com.sep490.bms.entity.location.OpeningHour;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Một ngày trong tuần của giờ mở cửa địa điểm.
 *
 * GET luôn trả đủ 7 ngày. Ngày chưa cấu hình có configured = false
 * và các trường giờ bằng null để FE hiển thị "chưa thiết lập".
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OpeningHourDto {

    /** 1 = Thứ 2 ... 7 = Chủ nhật. */
    private int dayOfWeek;

    private String dayName;

    private Integer openMinute;

    private Integer closeMinute;

    /** "06:00" - tiện cho FE, cùng giá trị với openMinute. */
    private String openTime;

    /** "22:30" - tiện cho FE, cùng giá trị với closeMinute. */
    private String closeTime;

    /** Số phút mở cửa trong ngày, null nếu ngày chưa cấu hình. */
    private Integer durationMinutes;

    private boolean configured;

    public static OpeningHourDto fromEntity(OpeningHour entity) {
        int open = entity.getOpenMinute();
        int close = entity.getCloseMinute();
        return OpeningHourDto.builder()
                .dayOfWeek(entity.getDayOfWeek())
                .dayName(OpeningTime.dayName(entity.getDayOfWeek()))
                .openMinute(open)
                .closeMinute(close)
                .openTime(OpeningTime.toTime(open))
                .closeTime(OpeningTime.toTime(close))
                .durationMinutes(close - open)
                .configured(true)
                .build();
    }

    public static OpeningHourDto unconfigured(int dayOfWeek) {
        return OpeningHourDto.builder()
                .dayOfWeek(dayOfWeek)
                .dayName(OpeningTime.dayName(dayOfWeek))
                .configured(false)
                .build();
    }
}
