package com.sep490.bms.dto.team;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Nhận số người hiện có và số chỗ cần tuyển mà chủ kèo muốn sửa.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateMatchRequest {

    @Min(value = 1, message = "Số người đã có tối thiểu là 1")
    @Max(value = 7, message = "Số người đã có tối đa là 7")
    private Integer currentPlayers;

    @Min(value = 1, message = "Số người cần tìm tối thiểu là 1")
    @Max(value = 7, message = "Số người cần tìm tối đa là 7")
    private Integer neededPlayers;
}
