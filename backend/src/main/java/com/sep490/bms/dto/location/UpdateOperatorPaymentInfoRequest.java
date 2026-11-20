package com.sep490.bms.dto.location;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * UC06 #8, FR127, DR28: Admin sửa ngân hàng, số tài khoản, tên chủ tài khoản của bên vận hành.
 * Ảnh QR gửi riêng qua POST /api/admin/operator-payment-info/qr. Độ dài trường giống thông tin chuyển khoản của địa điểm.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateOperatorPaymentInfoRequest {

    @NotBlank(message = "Tên ngân hàng không được để trống")
    @Size(max = 100, message = "Tên ngân hàng tối đa 100 ký tự")
    private String bankName;

    @NotBlank(message = "Số tài khoản không được để trống")
    @Size(max = 30, message = "Số tài khoản tối đa 30 ký tự")
    private String bankAccountNo;

    @NotBlank(message = "Tên chủ tài khoản không được để trống")
    @Size(max = 100, message = "Tên chủ tài khoản tối đa 100 ký tự")
    private String bankAccountHolder;
}
