package com.sep490.bms.repository.booking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.booking.BookingSlot;

@Repository
public interface BookingSlotRepository extends JpaRepository<BookingSlot, Long> {
}
