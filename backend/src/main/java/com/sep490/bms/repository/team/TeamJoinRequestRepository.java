package com.sep490.bms.repository.team;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sep490.bms.entity.team.JoinRequestStatus;
import com.sep490.bms.entity.team.TeamJoinRequest;

/**
 * Tra cứu yêu cầu tham gia đội theo đội, Player và trạng thái xét duyệt.
 */
public interface TeamJoinRequestRepository extends JpaRepository<TeamJoinRequest, Long> {

    boolean existsByTeamIdAndPlayerIdAndStatus(Long teamId, Long playerId, JoinRequestStatus status);

    List<TeamJoinRequest> findByTeamIdOrderByCreatedAtDesc(Long teamId);

    List<TeamJoinRequest> findByTeamIdAndStatusOrderByCreatedAtDesc(Long teamId, JoinRequestStatus status);
}
