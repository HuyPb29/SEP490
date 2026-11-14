package com.sep490.bms.repository.booking;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.booking.BookingSlot;

/**
 * Tra cứu slot đang chiếm lịch theo sân và ngày, đồng thời giải phóng slot của booking.
 */
@Repository
public interface BookingSlotRepository extends JpaRepository<BookingSlot, Long> {

    /** Slot đang được giữ hoặc đã đặt (is_active = 1) của các sân trong một ngày. */
    List<BookingSlot> findByCourtIdInAndSlotDateAndActiveTrue(Collection<Long> courtIds, LocalDate slotDate);

    /**
     * Nhả mọi slot booking đang giữ (is_active = 0) để người khác đặt được: unique ux_slot_active
     * chỉ áp cho slot còn hiệu lực. Dòng slot vẫn giữ lại làm lịch sử, kèm giá lúc đặt.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("UPDATE BookingSlot s SET s.active = false WHERE s.bookingId = :bookingId AND s.active = true")
    int deactivateByBookingId(@Param("bookingId") Long bookingId);
}
