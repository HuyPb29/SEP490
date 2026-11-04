package com.sep490.bms.repository.booking;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.booking.BookingPackage;

@Repository
public interface BookingPackageRepository extends JpaRepository<BookingPackage, Long> {

    /** Số gói đang chờ thanh toán của Player, mỗi gói tính là một (BR35, D87). Cùng điều kiện với booking lẻ. */
    @Query("""
            SELECT COUNT(p) FROM BookingPackage p
            WHERE p.playerId = :playerId
              AND (p.status IN (com.sep490.bms.entity.enums.BookingStatus.AWAITING_CONFIRMATION,
                                com.sep490.bms.entity.enums.BookingStatus.RESUBMIT_REQUESTED)
                   OR (p.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND p.holdExpiresAt > :now))
            """)
    long countPendingPayment(@Param("playerId") Long playerId, @Param("now") LocalDateTime now);
}
