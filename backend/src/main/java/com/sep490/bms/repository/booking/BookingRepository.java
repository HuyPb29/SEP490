package com.sep490.bms.repository.booking;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.booking.Booking;

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
}
