package com.sep490.bms.repository.promotion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.promotion.VoucherGrant;

@Repository
public interface VoucherGrantRepository extends JpaRepository<VoucherGrant, Long> {
    org.springframework.data.domain.Page<VoucherGrant> findByPlayerId(Long playerId, org.springframework.data.domain.Pageable page);
}
