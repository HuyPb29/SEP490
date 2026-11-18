package com.sep490.bms.dto.team;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Chủ đội đổi trình độ của đội (FR91, DR33).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateTeamRequest {
    @NotBlank(message = "Vui lòng chọn trình độ của đội")
    private String skillLevel;
}
