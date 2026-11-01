package com.sep490.bms.dto.location;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Owner tạo ngày mở cửa ngoại lệ.
 *
 * Giờ gửi theo openMinute/closeMinute hoặc openTime/closeTime ("HH:mm").
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateOpeningExceptionRequest {

    @NotNull(message = "Ngày ngoại lệ không được để trống")
    private LocalDate exceptionDate;

    private Integer openMinute;

    private Integer closeMinute;

    private String openTime;

    private String closeTime;

    @Size(max = 255, message = "Ghi chú tối đa 255 ký tự")
    private String note;
}
