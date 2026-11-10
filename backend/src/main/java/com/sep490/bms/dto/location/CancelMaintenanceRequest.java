package com.sep490.bms.dto.location;

import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC10 - Người tạo rút yêu cầu bảo trì khi còn PENDING.
 *
 * Lý do huỷ là tùy chọn: rút yêu cầu của chính mình không bắt buộc phải giải trình,
 * nhưng nếu có thì được lưu vào cột cancel_reason để giữ vết.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CancelMaintenanceRequest {

    @Size(max = 500, message = "Lý do huỷ tối đa 500 ký tự")
    private String reason;
}
