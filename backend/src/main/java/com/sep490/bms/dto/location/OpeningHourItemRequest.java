package com.sep490.bms.dto.location;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Một ngày trong tuần khi Owner cập nhật giờ mở cửa.
 *
 * Gửi giờ theo 1 trong 2 cách:
 * - openMinute / closeMinute: số phút tính từ 00:00 (360 = 06:00)
 * - openTime / closeTime: chuỗi "HH:mm" ("06:00")
 * Nếu gửi cả hai, openMinute / closeMinute được ưu tiên.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OpeningHourItemRequest {

    @NotNull(message = "Thứ trong tuần không được để trống")
    @Min(value = 1, message = "Thứ trong tuần nhỏ nhất là 1 (Thứ 2)")
    @Max(value = 7, message = "Thứ trong tuần lớn nhất là 7 (Chủ nhật)")
    private Integer dayOfWeek;

    private Integer openMinute;

    private Integer closeMinute;

    private String openTime;

    private String closeTime;
}
