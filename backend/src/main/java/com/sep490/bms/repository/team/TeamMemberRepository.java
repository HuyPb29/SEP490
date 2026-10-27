package com.sep490.bms.repository.team;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sep490.bms.entity.team.TeamMember;
import com.sep490.bms.entity.team.TeamMemberStatus;

public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    List<TeamMember> findByTeamIdAndStatusOrderByJoinedAtAsc(Long teamId, TeamMemberStatus status);

    Optional<TeamMember> findByTeamIdAndPlayerIdAndStatus(Long teamId, Long playerId, TeamMemberStatus status);

    boolean existsByTeamIdAndPlayerIdAndStatus(Long teamId, Long playerId, TeamMemberStatus status);

    long countByTeamIdAndStatus(Long teamId, TeamMemberStatus status);
}
