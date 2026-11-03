package com.sep490.bms.repository.booking;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    boolean existsByBookingCode(String bookingCode);

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
