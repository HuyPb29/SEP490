package com.sep490.bms.repository.promotion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.promotion.PlayerLocationBalance;

@Repository
public interface PlayerLocationBalanceRepository extends JpaRepository<PlayerLocationBalance, Long> {
    java.util.Optional<PlayerLocationBalance> findByPlayerIdAndLocationId(Long playerId,Long locationId);
    org.springframework.data.domain.Page<PlayerLocationBalance> findByPlayerId(Long playerId,org.springframework.data.domain.Pageable page);
}
