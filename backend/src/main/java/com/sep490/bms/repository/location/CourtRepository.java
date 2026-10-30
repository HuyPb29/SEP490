package com.sep490.bms.repository.location;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.Court;

@Repository
public interface CourtRepository extends JpaRepository<Court, Long> {

    /**
     * F2 - UC07: sân của một địa điểm.
     * Dùng index của ux_court_name (location_id, name) nên không phát sinh sort.
     */
    List<Court> findAllByLocationIdOrderByNameAsc(Long locationId);

    /** F2 - UC07: kiểm tra trùng tên sân trong cùng một địa điểm. */
    Optional<Court> findByLocationIdAndNameIgnoreCase(Long locationId, String name);
}
