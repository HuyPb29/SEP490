package com.sep490.bms.repository.booking;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.booking.BookingSlot;

@Repository
public interface BookingSlotRepository extends JpaRepository<BookingSlot, Long> {

    /** Slot đang được giữ hoặc đã đặt (is_active = 1) của các sân trong một ngày. */
    List<BookingSlot> findByCourtIdInAndSlotDateAndActiveTrue(Collection<Long> courtIds, LocalDate slotDate);
}
