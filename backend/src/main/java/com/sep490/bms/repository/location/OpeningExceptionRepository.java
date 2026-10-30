package com.sep490.bms.repository.location;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.OpeningException;

@Repository
public interface OpeningExceptionRepository extends JpaRepository<OpeningException, Long> {

    /**
     * F2 - UC08: ngày ngoại lệ của một địa điểm.
     * Dùng index của ux_oexc_date (location_id, exception_date) nên không phát sinh sort.
     */
    List<OpeningException> findAllByLocationIdOrderByExceptionDateAsc(Long locationId);

    /** F2 - UC08: kiểm tra trùng ngày ngoại lệ (ràng buộc ux_oexc_date). */
    Optional<OpeningException> findByLocationIdAndExceptionDate(Long locationId, LocalDate exceptionDate);
}
