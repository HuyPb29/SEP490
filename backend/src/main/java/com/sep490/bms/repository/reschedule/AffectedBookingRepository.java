package com.sep490.bms.repository.reschedule;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.reschedule.AffectedBooking;

@Repository
public interface AffectedBookingRepository extends JpaRepository<AffectedBooking, Long> {
}
