package com.sep490.bms.repository.booking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.booking.BookingPackage;

@Repository
public interface BookingPackageRepository extends JpaRepository<BookingPackage, Long> {
}
