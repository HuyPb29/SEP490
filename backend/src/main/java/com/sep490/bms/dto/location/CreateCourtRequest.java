package com.sep490.bms.dto.location;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** UC07 - Owner thêm sân con cho địa điểm. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateCourtRequest {

    @NotBlank(message = "Tên sân không được để trống")
    @Size(max = 50, message = "Tên sân tối đa 50 ký tự")
    private String name;

    @Size(max = 255, message = "Mô tả tối đa 255 ký tự")
    private String description;
}
