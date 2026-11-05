package com.sep490.bms.repository.booking;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;

import jakarta.persistence.LockModeType;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    boolean existsByBookingCode(String bookingCode);

    /**
     * Đọc và khóa dòng booking đến hết giao dịch (SQL Server: UPDLOCK). Hai request cùng xử lý một booking,
     * ví dụ bấm Báo đã thanh toán hai lần, thì request sau phải chờ request trước xong (FR56).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.id = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") Long id);

    /**
     * Số booking lẻ đang chờ thanh toán của Player (BR35, D87): Chờ xác nhận, Chờ bổ sung, và Đang giữ chỗ
     * còn hạn. Đang giữ chỗ đã quá hạn thì không đếm, dù job UC37 chưa kịp chuyển sang Hết hạn.
     * Buổi con của gói (package_id có giá trị) không đếm ở đây: cả gói tính là một, đếm ở BookingPackageRepository.
     */
    @Query("""
            SELECT COUNT(b) FROM Booking b
            WHERE b.playerId = :playerId AND b.packageId IS NULL
              AND (b.status IN (com.sep490.bms.entity.enums.BookingStatus.AWAITING_CONFIRMATION,
                                com.sep490.bms.entity.enums.BookingStatus.RESUBMIT_REQUESTED)
                   OR (b.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND b.holdExpiresAt > :now))
            """)
    long countPendingPayment(@Param("playerId") Long playerId, @Param("now") LocalDateTime now);

    /**
     * UC17 #1–2, FR51: booking lẻ của Player (không gồm buổi trong gói, gói xem riêng), lọc theo trạng thái.
     * Booking đang chờ thanh toán xếp đầu, cùng điều kiện với countPendingPayment; sau đó mới đặt trước.
     * Đang giữ chỗ đã quá hạn tính là Hết hạn, dù job UC37 chưa kịp đổi trạng thái: lọc Đang giữ chỗ
     * thì không lấy, lọc Hết hạn thì lấy. status = null: không lọc.
     */
    @Query(value = """
            SELECT b FROM Booking b
            WHERE b.playerId = :playerId AND b.packageId IS NULL
              AND (:status IS NULL
                   OR (b.status = :status
                       AND (b.status <> com.sep490.bms.entity.enums.BookingStatus.HOLDING OR b.holdExpiresAt > :now))
                   OR (:status = com.sep490.bms.entity.enums.BookingStatus.EXPIRED
                       AND b.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND b.holdExpiresAt <= :now))
            ORDER BY CASE WHEN b.status IN (com.sep490.bms.entity.enums.BookingStatus.AWAITING_CONFIRMATION,
                                            com.sep490.bms.entity.enums.BookingStatus.RESUBMIT_REQUESTED)
                               OR (b.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND b.holdExpiresAt > :now)
                          THEN 0 ELSE 1 END,
                     b.createdAt DESC, b.id DESC
            """,
            countQuery = """
            SELECT COUNT(b) FROM Booking b
            WHERE b.playerId = :playerId AND b.packageId IS NULL
              AND (:status IS NULL
                   OR (b.status = :status
                       AND (b.status <> com.sep490.bms.entity.enums.BookingStatus.HOLDING OR b.holdExpiresAt > :now))
                   OR (:status = com.sep490.bms.entity.enums.BookingStatus.EXPIRED
                       AND b.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND b.holdExpiresAt <= :now))
            """)
    Page<Booking> findPlayerBookings(@Param("playerId") Long playerId, @Param("status") BookingStatus status,
            @Param("now") LocalDateTime now, Pageable pageable);
}
