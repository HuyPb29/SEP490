package com.sep490.bms.dto.location;

import java.time.LocalDate;

import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Owner sửa ngày mở cửa ngoại lệ. Tất cả trường tuỳ chọn:
 * trường null nghĩa là giữ nguyên giá trị hiện tại.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateOpeningExceptionRequest {

    private LocalDate exceptionDate;

    private Integer openMinute;

    private Integer closeMinute;

    private String openTime;

    private String closeTime;

    @Size(max = 255, message = "Ghi chú tối đa 255 ký tự")
    private String note;
}
