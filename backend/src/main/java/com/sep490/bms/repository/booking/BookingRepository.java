package com.sep490.bms.repository.booking;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
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

    /**
     * UC16, FR47, FR48: booking tại quầy của một địa điểm cho Staff, lọc theo ngày chơi và trạng thái
     * (null: không lọc). Booking đang giữ chỗ còn hạn xếp đầu để Staff xác nhận kịp; sau đó mới tạo trước.
     * Đang giữ chỗ đã quá hạn tính là Hết hạn như findPlayerBookings.
     */
    @Query(value = """
            SELECT b FROM Booking b
            WHERE b.locationId = :locationId
              AND b.bookingType = com.sep490.bms.entity.enums.BookingType.WALK_IN
              AND (:date IS NULL OR b.playDate = :date)
              AND (:status IS NULL
                   OR (b.status = :status
                       AND (b.status <> com.sep490.bms.entity.enums.BookingStatus.HOLDING OR b.holdExpiresAt > :now))
                   OR (:status = com.sep490.bms.entity.enums.BookingStatus.EXPIRED
                       AND b.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND b.holdExpiresAt <= :now))
            ORDER BY CASE WHEN b.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND b.holdExpiresAt > :now
                          THEN 0 ELSE 1 END,
                     b.createdAt DESC, b.id DESC
            """,
            countQuery = """
            SELECT COUNT(b) FROM Booking b
            WHERE b.locationId = :locationId
              AND b.bookingType = com.sep490.bms.entity.enums.BookingType.WALK_IN
              AND (:date IS NULL OR b.playDate = :date)
              AND (:status IS NULL
                   OR (b.status = :status
                       AND (b.status <> com.sep490.bms.entity.enums.BookingStatus.HOLDING OR b.holdExpiresAt > :now))
                   OR (:status = com.sep490.bms.entity.enums.BookingStatus.EXPIRED
                       AND b.status = com.sep490.bms.entity.enums.BookingStatus.HOLDING AND b.holdExpiresAt <= :now))
            """)
    Page<Booking> findLocationWalkIns(@Param("locationId") Long locationId, @Param("date") LocalDate date,
            @Param("status") BookingStatus status, @Param("now") LocalDateTime now, Pageable pageable);

    /** UC17: các buổi của một gói, theo ngày giờ chơi. */
    List<Booking> findByPackageIdOrderByPlayDateAscStartMinuteAscIdAsc(Long packageId);

    /** UC17 #1: số buổi của từng gói trong một trang danh sách gói, đọc một lần. */
    @Query("""
            SELECT b.packageId AS packageId, COUNT(b) AS sessionCount FROM Booking b
            WHERE b.packageId IN :packageIds
            GROUP BY b.packageId
            """)
    List<PackageSessionCount> countSessionsByPackageIds(@Param("packageIds") Collection<Long> packageIds);

    /** Kết quả của countSessionsByPackageIds. */
    interface PackageSessionCount {
        Long getPackageId();

        long getSessionCount();
    }

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
