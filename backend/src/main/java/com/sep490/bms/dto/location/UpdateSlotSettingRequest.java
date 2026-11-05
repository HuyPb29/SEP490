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
 * UC08 - Owner cập nhật cấu hình slot của địa điểm (FR18).
 *
 * PUT thay thế toàn phần nên cả 3 trường đều bắt buộc. Giá trị phải là bội số 30
 * để khớp cách chia slot của toàn hệ thống (booking_slot, price_rule, opening_hour).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateSlotSettingRequest {

    @NotNull(message = "Độ dài slot không được để trống")
    @Min(value = 30, message = "Độ dài slot tối thiểu 30 phút")
    @Max(value = 240, message = "Độ dài slot tối đa 240 phút")
    private Integer slotMinutes;

    @NotNull(message = "Thời gian nghỉ giữa hai slot không được để trống")
    @Min(value = 0, message = "Thời gian nghỉ không được âm")
    @Max(value = 60, message = "Thời gian nghỉ tối đa 60 phút")
    private Integer bufferMinutes;

    @NotNull(message = "Số slot tối đa mỗi lần đặt không được để trống")
    @Min(value = 1, message = "Số slot tối đa mỗi lần đặt tối thiểu 1")
    @Max(value = 12, message = "Số slot tối đa mỗi lần đặt tối đa 12")
    private Integer maxSlotsPerBooking;
}
