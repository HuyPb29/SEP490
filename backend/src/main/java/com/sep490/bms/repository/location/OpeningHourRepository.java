package com.sep490.bms.repository.location;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.OpeningHour;

@Repository
public interface OpeningHourRepository extends JpaRepository<OpeningHour, Long> {

    /** dayOfWeek: 1 = thứ Hai … 7 = Chủ nhật (giống DayOfWeek.getValue()). */
    Optional<OpeningHour> findByLocationIdAndDayOfWeek(Long locationId, int dayOfWeek);
}
