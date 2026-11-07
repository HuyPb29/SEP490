package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC09 - Owner sửa ưu đãi đặt theo lô. Trường null nghĩa là giữ nguyên giá trị hiện tại.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateBatchOfferRequest {

    @Size(max = 100, message = "Tên ưu đãi tối đa 100 ký tự")
    private String name;

    private LocalDate startDate;

    private LocalDate endDate;

    @DecimalMin(value = "1", message = "Giá trị gói tối thiểu phải lớn hơn 0")
    private BigDecimal minPackageAmount;

    private Long voucherId;
}
