package com.sep490.bms.repository.promotion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.promotion.VoucherUsage;

@Repository
public interface VoucherUsageRepository extends JpaRepository<VoucherUsage, Long> {
    long countByVoucherIdAndPlayerIdAndStatus(Long voucherId, Long playerId, com.sep490.bms.entity.enums.VoucherUsageStatus status);
    java.util.Optional<VoucherUsage> findByBookingId(Long bookingId);
    java.util.Optional<VoucherUsage> findByPackageId(Long packageId);
}
