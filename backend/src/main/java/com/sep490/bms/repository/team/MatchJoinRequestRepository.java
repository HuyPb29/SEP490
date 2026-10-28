package com.sep490.bms.repository.team;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sep490.bms.entity.team.JoinRequestStatus;
import com.sep490.bms.entity.team.MatchJoinRequest;

public interface MatchJoinRequestRepository extends JpaRepository<MatchJoinRequest, Long> {

    boolean existsByMatchIdAndPlayerIdAndStatusIn(Long matchId, Long playerId, Collection<JoinRequestStatus> statuses);

    boolean existsByMatchIdAndPlayerIdAndStatus(Long matchId, Long playerId, JoinRequestStatus status);

    Optional<MatchJoinRequest> findFirstByMatchIdAndPlayerIdOrderByCreatedAtDesc(Long matchId, Long playerId);

    List<MatchJoinRequest> findByMatchIdOrderByCreatedAtDesc(Long matchId);

    List<MatchJoinRequest> findByMatchIdAndStatusOrderByCreatedAtDesc(Long matchId, JoinRequestStatus status);

    List<MatchJoinRequest> findByMatchIdAndStatus(Long matchId, JoinRequestStatus status);
}
