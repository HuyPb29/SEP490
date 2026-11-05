package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.DecimalMin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC09 - Owner sửa một dòng bảng giá. Trường null nghĩa là giữ nguyên giá trị hiện tại.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdatePriceRuleRequest {

    private List<Integer> days;

    private String startTime;

    private Integer startMinute;

    private String endTime;

    private Integer endMinute;

    @DecimalMin(value = "1", message = "Giá mỗi slot phải lớn hơn 0")
    private BigDecimal pricePerSlot;

    private LocalDate validFrom;

    private LocalDate validTo;
}
