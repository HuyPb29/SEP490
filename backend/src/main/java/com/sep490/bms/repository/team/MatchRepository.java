package com.sep490.bms.repository.team;

import java.util.Collection;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sep490.bms.entity.team.Match;
import com.sep490.bms.entity.team.MatchStatus;

public interface MatchRepository extends JpaRepository<Match, Long> {

    boolean existsByBookingIdAndStatusIn(Long bookingId, Collection<MatchStatus> statuses);
}
