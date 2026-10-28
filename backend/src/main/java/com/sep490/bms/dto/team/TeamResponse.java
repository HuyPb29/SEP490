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
public class TeamResponse {

    private Long id;
    private String name;
    private Long captainId;
    private String captainName;
    private long memberCount;
    private boolean member;
    private boolean captain;
    private LocalDateTime createdAt;
}
