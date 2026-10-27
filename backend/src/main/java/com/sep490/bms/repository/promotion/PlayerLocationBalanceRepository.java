package com.sep490.bms.repository.promotion;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.promotion.PlayerLocationBalance;

@Repository
public interface PlayerLocationBalanceRepository extends JpaRepository<PlayerLocationBalance, Long> {

    Optional<PlayerLocationBalance> findByPlayerIdAndLocationId(Long playerId, Long locationId);
}
