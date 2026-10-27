package com.sep490.bms.dto.team;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Dùng chung cho yêu cầu vào đội và yêu cầu tham gia kèo. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JoinRequestCreateRequest {

    @NotNull(message = "Vui lòng xác nhận đồng ý chia sẻ số điện thoại")
    private Boolean phoneConsent;
}
