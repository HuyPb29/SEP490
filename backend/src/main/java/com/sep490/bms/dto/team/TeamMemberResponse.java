package com.sep490.bms.dto.team;

import java.time.LocalDateTime;

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
public class TeamMemberResponse {

    /** id của dòng team_member, dùng cho DELETE /api/team-members/{id}. */
    private Long id;
    private Long playerId;
    private String fullName;
    private String phone;
    private String skillLevel;
    private boolean captain;
    private LocalDateTime joinedAt;
}
