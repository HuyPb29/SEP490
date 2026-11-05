package com.sep490.bms.dto.location;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC05 - Owner gửi đơn đăng ký đưa địa điểm vào sử dụng hệ thống.
 *
 * Ràng buộc theo BMS_database.sql: ck_sreg_courts (court_count > 0),
 * ck_sreg_phone_digits (số điện thoại đúng 10 chữ số), toạ độ decimal(9,6).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateServiceRegistrationRequest {

    @NotBlank(message = "Tên địa điểm không được để trống")
    @Size(max = 100, message = "Tên địa điểm tối đa 100 ký tự")
    private String locationName;

    @NotBlank(message = "Địa chỉ không được để trống")
    @Size(max = 255, message = "Địa chỉ tối đa 255 ký tự")
    private String address;

    @NotNull(message = "Vĩ độ không được để trống")
    @DecimalMin(value = "-90", message = "Vĩ độ phải nằm trong khoảng -90 đến 90")
    @DecimalMax(value = "90", message = "Vĩ độ phải nằm trong khoảng -90 đến 90")
    private BigDecimal latitude;

    @NotNull(message = "Kinh độ không được để trống")
    @DecimalMin(value = "-180", message = "Kinh độ phải nằm trong khoảng -180 đến 180")
    @DecimalMax(value = "180", message = "Kinh độ phải nằm trong khoảng -180 đến 180")
    private BigDecimal longitude;

    @NotNull(message = "Số sân không được để trống")
    @Min(value = 1, message = "Số sân phải lớn hơn 0")
    private Integer courtCount;

    @Size(max = 50, message = "Tên người liên hệ tối đa 50 ký tự")
    private String contactName;

    @Pattern(regexp = "^[0-9]{10}$", message = "Số điện thoại liên hệ phải gồm đúng 10 chữ số")
    private String contactPhone;

    @Email(message = "Email liên hệ không hợp lệ")
    @Size(max = 100, message = "Email liên hệ tối đa 100 ký tự")
    private String contactEmail;
}
