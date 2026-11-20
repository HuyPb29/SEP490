package com.sep490.bms.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.*;

/**
 * Nhận họ tên và trình độ chơi mà người dùng muốn cập nhật.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UpdateProfileRequest {
    @Size(min = 2, max = 50, message = "Họ và tên phải có từ 2 đến 50 ký tự")
    @Pattern(regexp = ValidationRules.NAME, message = "Họ và tên chỉ được chứa chữ và khoảng trắng, không chứa số hoặc ký tự đặc biệt")
    private String fullName;
    @Pattern(regexp = "Mới chơi|Trung bình|Khá|Nâng cao",
            message = "Trình độ chơi phải là Mới chơi, Trung bình, Khá hoặc Nâng cao")
    private String skillLevel;
}
