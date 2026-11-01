package com.sep490.bms.dto.location;

import java.time.LocalDate;

import com.sep490.bms.entity.location.OpeningException;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Một ngày mở cửa ngoại lệ (FR18, BR04).
 *
 * Schema không có cột "đóng cửa" và có CHECK (close_minute > open_minute),
 * nên ngoại lệ chỉ biểu diễn việc mở cửa khác giờ thường, không biểu diễn ngày nghỉ.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OpeningExceptionDto {

    private Long id;

    private Long locationId;

    private LocalDate exceptionDate;

    private Integer openMinute;

    private Integer closeMinute;

    private String openTime;

    private String closeTime;

    private Integer durationMinutes;

    private String note;

    public static OpeningExceptionDto fromEntity(OpeningException entity) {
        int open = entity.getOpenMinute();
        int close = entity.getCloseMinute();
        return OpeningExceptionDto.builder()
                .id(entity.getId())
                .locationId(entity.getLocationId())
                .exceptionDate(entity.getExceptionDate())
                .openMinute(open)
                .closeMinute(close)
                .openTime(OpeningTime.toTime(open))
                .closeTime(OpeningTime.toTime(close))
                .durationMinutes(close - open)
                .note(entity.getNote())
                .build();
    }
}
