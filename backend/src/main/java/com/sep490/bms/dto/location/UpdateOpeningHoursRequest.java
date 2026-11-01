package com.sep490.bms.dto.location;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Owner gửi toàn bộ giờ mở cửa trong 1 lần (PUT thay thế toàn phần).
 *
 * Ngày không có trong danh sách sẽ bị xoá cấu hình (trở về "chưa thiết lập").
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateOpeningHoursRequest {

    @NotEmpty(message = "Phải cấu hình ít nhất một ngày mở cửa")
    @Valid
    private List<OpeningHourItemRequest> hours;
}
