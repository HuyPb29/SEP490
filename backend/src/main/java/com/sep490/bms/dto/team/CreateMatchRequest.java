package com.sep490.bms.dto.team;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateMatchRequest {

    @NotNull(message = "Booking không được để trống")
    private Long bookingId;

    @NotNull(message = "Số người đã có không được để trống")
    @Min(value = 1, message = "Số người đã có tối thiểu là 1")
    @Max(value = 7, message = "Số người đã có tối đa là 7")
    private Integer currentPlayers;

    @NotNull(message = "Số người cần tìm không được để trống")
    @Min(value = 1, message = "Số người cần tìm tối thiểu là 1")
    @Max(value = 7, message = "Số người cần tìm tối đa là 7")
    private Integer neededPlayers;
}
