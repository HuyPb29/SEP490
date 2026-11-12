package com.sep490.bms.repository.location;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.BatchOffer;

/**
 * Tra cứu chương trình ưu đãi đặt theo lô của một địa điểm.
 */
@Repository
public interface BatchOfferRepository extends JpaRepository<BatchOffer, Long> {

    /** Ưu đãi theo lô của địa điểm, ưu đãi mới nhất lên đầu. */
    List<BatchOffer> findAllByLocationIdOrderByStartDateDescIdDesc(Long locationId);

    @org.springframework.data.jpa.repository.Query("""
            select count(b) from BatchOffer b where b.locationId = :locationId
            and b.startDate <= :endDate and b.endDate >= :startDate
            and (:excludedId is null or b.id <> :excludedId)
            """)
    long countOverlapping(Long locationId, LocalDate startDate, LocalDate endDate, Long excludedId);
}
