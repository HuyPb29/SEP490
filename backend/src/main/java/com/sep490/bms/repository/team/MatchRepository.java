package com.sep490.bms.repository.team;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sep490.bms.entity.team.Match;
import com.sep490.bms.entity.team.MatchStatus;

import jakarta.persistence.LockModeType;

public interface MatchRepository extends JpaRepository<Match, Long> {

    boolean existsByBookingIdAndStatusIn(Long bookingId, Collection<MatchStatus> statuses);

    Optional<Match> findFirstByBookingIdAndStatusIn(Long bookingId, Collection<MatchStatus> statuses);

    /** Khóa kèo của booking khi booking bị hủy, tránh chạy song song với chủ kèo đóng/hủy kèo. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Match m WHERE m.bookingId = :bookingId AND m.status IN :statuses")
    List<Match> findByBookingIdAndStatusInForUpdate(@Param("bookingId") Long bookingId,
            @Param("statuses") Collection<MatchStatus> statuses);
}
