package com.sep490.bms.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UpdateProfileRequest {
    @Size(min = 2, max = 50)
    @Pattern(regexp = ValidationRules.NAME, message = "Họ tên chỉ được chứa chữ và khoảng trắng")
    private String fullName;
    @Size(max = 30)
    private String skillLevel;
}
