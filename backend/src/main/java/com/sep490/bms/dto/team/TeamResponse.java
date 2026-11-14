package com.sep490.bms.dto.team;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Trả thông tin đội, đội trưởng, số thành viên và quan hệ của người xem với đội.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamResponse {

    private Long id;
    private String name;
    private Long captainId;
    private String captainName;
    private long memberCount;
    private boolean member;
    private boolean captain;
    /** DR12: tối đa 20 thành viên, để màn hình hiện "số thành viên/tối đa" (D78). */
    private int maxMembers;
    /** Yêu cầu vào đội đang chờ của người xem (PENDING) — null nếu không có. */
    private String myJoinStatus;
    private Long myJoinRequestId;
    private LocalDateTime createdAt;
}
