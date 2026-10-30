package com.sep490.bms.repository.location;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.Court;

@Repository
public interface CourtRepository extends JpaRepository<Court, Long> {

    /** Sân đang bật của một địa điểm; xếp theo id để "Sân 10" không đứng trước "Sân 2". */
    List<Court> findAllByLocationIdAndActiveTrueOrderById(Long locationId);

    Optional<Court> findByIdAndActiveTrue(Long id);
}
