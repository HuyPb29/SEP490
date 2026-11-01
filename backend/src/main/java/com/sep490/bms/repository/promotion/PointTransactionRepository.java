package com.sep490.bms.repository.promotion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.promotion.PointTransaction;

@Repository
public interface PointTransactionRepository extends JpaRepository<PointTransaction, Long>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<PointTransaction> {
    java.util.Optional<PointTransaction> findFirstByBookingIdAndTypeOrderByIdAsc(Long bookingId,com.sep490.bms.entity.enums.PointTransactionType type);
    java.util.Optional<PointTransaction> findFirstByPackageIdAndTypeOrderByIdAsc(Long packageId,com.sep490.bms.entity.enums.PointTransactionType type);
}
