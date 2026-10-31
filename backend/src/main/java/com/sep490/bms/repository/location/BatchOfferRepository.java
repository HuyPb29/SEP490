package com.sep490.bms.repository.location;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.BatchOffer;

@Repository
public interface BatchOfferRepository extends JpaRepository<BatchOffer, Long> {

    /** Ưu đãi theo lô của địa điểm, ưu đãi mới nhất lên đầu. */
    List<BatchOffer> findAllByLocationIdOrderByStartDateDescIdDesc(Long locationId);
}
