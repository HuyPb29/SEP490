package com.sep490.bms.repository.booking;

import java.time.LocalDateTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.booking.BookingPackage;
import com.sep490.bms.entity.enums.BookingStatus;

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

    /**
     * UC17 #1–2, FR51: gói đặt nhiều buổi của Player, lọc theo trạng thái. Cùng cách xếp và lọc với
     * BookingRepository.findPlayerBookings: gói đang chờ thanh toán xếp đầu, sau đó mới đặt trước;
     * Đang giữ chỗ đã quá hạn tính là Hết hạn. status = null: không lọc.
     */
    @Query(value = """
            SELECT p FROM BookingPackage p
            WHERE p.playerId = :playerId
              AND (:status IS NULL
                   OR (p.status = :status
                       AND (p.status <> com.sep490.bms.entity.enums.BookingStatus.HOLDING OR p.holdExpiresAt > :now))
                   OR (:status = com.sep490.bms.entity.enums.BookingStatus.EXPIRED
                       AND p.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND p.holdExpiresAt <= :now))
            ORDER BY CASE WHEN p.status IN (com.sep490.bms.entity.enums.BookingStatus.AWAITING_CONFIRMATION,
                                            com.sep490.bms.entity.enums.BookingStatus.RESUBMIT_REQUESTED)
                               OR (p.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND p.holdExpiresAt > :now)
                          THEN 0 ELSE 1 END,
                     p.createdAt DESC, p.id DESC
            """,
            countQuery = """
            SELECT COUNT(p) FROM BookingPackage p
            WHERE p.playerId = :playerId
              AND (:status IS NULL
                   OR (p.status = :status
                       AND (p.status <> com.sep490.bms.entity.enums.BookingStatus.HOLDING OR p.holdExpiresAt > :now))
                   OR (:status = com.sep490.bms.entity.enums.BookingStatus.EXPIRED
                       AND p.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND p.holdExpiresAt <= :now))
            """)
    Page<BookingPackage> findPlayerPackages(@Param("playerId") Long playerId, @Param("status") BookingStatus status,
            @Param("now") LocalDateTime now, Pageable pageable);
}
