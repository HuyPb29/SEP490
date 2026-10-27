package com.sep490.bms.dto.team;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Dùng chung cho yêu cầu vào đội (targetId = teamId) và yêu cầu tham gia kèo (targetId = matchId). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JoinRequestResponse {

    private Long id;
    private Long targetId;
    private Long playerId;
    private String fullName;
    private String phone;
    private String skillLevel;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime decidedAt;
}
