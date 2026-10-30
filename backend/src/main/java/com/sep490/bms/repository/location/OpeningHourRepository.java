package com.sep490.bms.repository.location;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.OpeningHour;

@Repository
public interface OpeningHourRepository extends JpaRepository<OpeningHour, Long> {

    /**
     * F2 - UC08: giờ mở cửa của một địa điểm.
     * Dùng index của ux_ohour_day (location_id, day_of_week) nên không phát sinh sort.
     */
    List<OpeningHour> findAllByLocationIdOrderByDayOfWeekAsc(Long locationId);
}
