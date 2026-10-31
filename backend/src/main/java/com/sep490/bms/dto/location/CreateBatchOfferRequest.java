package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
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
 * UC09 - Owner tạo ưu đãi đặt theo lô.
 *
 * voucherId trỏ tới voucher do F6 (UC24) tạo cho cùng địa điểm, trạng thái PUBLISHED.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateBatchOfferRequest {

    @NotBlank(message = "Tên ưu đãi không được để trống")
    @Size(max = 100, message = "Tên ưu đãi tối đa 100 ký tự")
    private String name;

    @NotNull(message = "Ngày bắt đầu không được để trống")
    private LocalDate startDate;

    @NotNull(message = "Ngày kết thúc không được để trống")
    private LocalDate endDate;

    @NotNull(message = "Giá trị gói tối thiểu không được để trống")
    @DecimalMin(value = "1", message = "Giá trị gói tối thiểu phải lớn hơn 0")
    private BigDecimal minPackageAmount;

    @NotNull(message = "Voucher áp dụng không được để trống")
    private Long voucherId;
}
