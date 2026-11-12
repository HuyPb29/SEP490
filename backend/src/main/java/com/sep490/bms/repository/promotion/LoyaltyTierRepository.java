package com.sep490.bms.repository.promotion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.promotion.LoyaltyTier;

/**
 * Tra cứu và kiểm tra trùng các mốc ưu đãi tích lũy của địa điểm.
 */
@Repository
public interface LoyaltyTierRepository extends JpaRepository<LoyaltyTier, Long> {
    java.util.List<LoyaltyTier> findByLocationIdOrderByMilestoneAmountAsc(Long locationId);
    boolean existsByLocationIdAndMilestoneAmount(Long locationId,java.math.BigDecimal amount);
}
