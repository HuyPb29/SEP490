package com.sep490.bms.dto.location;

import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * UC07 - Owner cập nhật sân. Trường null nghĩa là giữ nguyên giá trị hiện tại.
 * isActive dùng để tạm ngưng hoạt động sân (không xoá dữ liệu).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateCourtRequest {

    @Size(max = 50, message = "Tên sân tối đa 50 ký tự")
    private String name;

    @Size(max = 255, message = "Mô tả tối đa 255 ký tự")
    private String description;

    private Boolean isActive;
}
