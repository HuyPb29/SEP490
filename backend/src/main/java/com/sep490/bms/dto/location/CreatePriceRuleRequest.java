package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC09 - Owner thêm một dòng bảng giá cho sân.
 *
 * Giờ gửi theo startTime/endTime ("HH:mm") hoặc startMinute/endMinute (phút tính từ 00:00).
 * Ngày áp dụng gửi theo chuẩn ISO: 1 = Thứ 2 ... 7 = Chủ nhật.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreatePriceRuleRequest {

    @NotEmpty(message = "Phải chọn ít nhất một ngày áp dụng giá")
    private List<Integer> days;

    private String startTime;

    private Integer startMinute;

    private String endTime;

    private Integer endMinute;

    @NotNull(message = "Giá mỗi slot không được để trống")
    @DecimalMin(value = "1", message = "Giá mỗi slot phải lớn hơn 0")
    private BigDecimal pricePerSlot;

    @NotNull(message = "Ngày bắt đầu hiệu lực không được để trống")
    private LocalDate validFrom;

    private LocalDate validTo;
}
