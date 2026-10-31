package com.sep490.bms.dto.location;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC06 - Admin khoá hoặc mở lại địa điểm (ck_location_status: ACTIVE | LOCKED).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateLocationStatusRequest {

    @NotBlank(message = "Trạng thái không được để trống")
    @Pattern(regexp = "ACTIVE|LOCKED", message = "Trạng thái chỉ nhận ACTIVE hoặc LOCKED")
    private String status;
}
