package com.sep490.bms.repository.booking;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.booking.BookingPackage;
import com.sep490.bms.entity.enums.BookingStatus;

import jakarta.persistence.LockModeType;

/**
 * Truy vấn gói theo Player, tìm gói chờ thanh toán hoặc hết hạn và khóa gói khi xử lý.
 */
@Repository
public interface BookingPackageRepository extends JpaRepository<BookingPackage, Long> {

    /**
     * Đọc và khóa dòng gói đến hết giao dịch (SQL Server: UPDLOCK): gửi chứng từ, Staff xử lý và job hết hạn
     * giữ chỗ cùng chạm một gói thì chạy lần lượt (FR56).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM BookingPackage p WHERE p.id = :id")
    Optional<BookingPackage> findByIdForUpdate(@Param("id") Long id);

    /** UC37: gói còn Đang giữ chỗ nhưng đã quá 15 phút (P27). */
    List<BookingPackage> findAllByStatusAndHoldExpiresAtBefore(BookingStatus status, LocalDateTime moment);

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
