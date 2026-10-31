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
 * Owner: Minh Anh
 * UC05 - Admin từ chối đơn đăng ký. Lý do là bắt buộc (ck_sreg_reject_reason).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RejectServiceRegistrationRequest {

    @NotBlank(message = "Lý do từ chối không được để trống")
    @Size(max = 500, message = "Lý do từ chối tối đa 500 ký tự")
    private String reason;
}
