package com.sep490.bms.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.*;

/**
 * Nhận họ tên và trình độ chơi mà người dùng muốn cập nhật.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UpdateProfileRequest {
    @Size(min = 2, max = 50)
    @Pattern(regexp = ValidationRules.NAME, message = "Họ tên chỉ được chứa chữ và khoảng trắng")
    private String fullName;
    @Pattern(regexp = "Mới chơi|Trung bình|Khá|Nâng cao",
            message = "Chọn một trong bốn mức trình độ chơi theo DR33")
    private String skillLevel;
}
