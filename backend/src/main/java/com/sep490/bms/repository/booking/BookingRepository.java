package com.sep490.bms.repository.booking;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

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

    // Giữ query UC14/UC18–19 của Minh và bổ sung query UC37 của AnhVM; không thay thế nhau.
    /** UC37 - Đơn còn HOLDING nhưng đã quá hạn giữ chỗ (hold_expires_at). */
    List<Booking> findAllByStatusAndHoldExpiresAtBefore(BookingStatus status, LocalDateTime moment);

    /**
     * UC37 - Đơn đã tới giờ bắt đầu, tính theo play_date + start_minute
     * (start_minute là phút tính từ 00:00, ví dụ 600 = 10:00).
     */
    @Query("select b from Booking b where b.status = :status"
            + " and (b.playDate < :date or (b.playDate = :date and b.startMinute <= :minute))")
    List<Booking> findReachedStart(@Param("status") BookingStatus status,
            @Param("date") LocalDate date,
            @Param("minute") int minute);

    /** UC37 - Đơn đã qua giờ kết thúc, tính theo play_date + end_minute. */
    @Query("select b from Booking b where b.status = :status"
            + " and (b.playDate < :date or (b.playDate = :date and b.endMinute <= :minute))")
    List<Booking> findReachedEnd(@Param("status") BookingStatus status,
            @Param("date") LocalDate date,
            @Param("minute") int minute);
}
