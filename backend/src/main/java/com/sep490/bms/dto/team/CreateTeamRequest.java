package com.sep490.bms.dto.team;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Nhận tên đội mới do Player tạo.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateTeamRequest {

    @NotBlank(message = "Tên đội không được để trống")
    @Size(max = 30, message = "Tên đội tối đa 30 ký tự")
    private String name;
}
