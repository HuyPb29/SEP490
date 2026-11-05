package com.sep490.bms.dto.location;

import java.time.LocalDateTime;

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
 * UC10 - Staff gửi yêu cầu bảo trì sân (FR23).
 *
 * Thời gian gửi theo ISO-8601 (ví dụ 2026-01-05T08:00:00) và phải trùng khung
 * 30 phút: phút 00 hoặc 30, giây bằng 0 - đúng ràng buộc ck_maint_half của bảng.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateMaintenanceRequest {

    @NotNull(message = "Sân cần bảo trì không được để trống")
    private Long courtId;

    @NotNull(message = "Thời gian bắt đầu không được để trống")
    private LocalDateTime startAt;

    @NotNull(message = "Thời gian kết thúc không được để trống")
    private LocalDateTime endAt;

    @NotBlank(message = "Lý do bảo trì không được để trống")
    @Size(max = 500, message = "Lý do bảo trì tối đa 500 ký tự")
    private String reason;
}
