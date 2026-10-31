package com.sep490.bms.repository.location;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.ServiceTerm;

@Repository
public interface ServiceTermRepository extends JpaRepository<ServiceTerm, Long> {

    /** UC06 - Kỳ hạn dịch vụ của địa điểm, kỳ mới nhất lên đầu. */
    List<ServiceTerm> findAllByLocationIdOrderByStartDateDescIdDesc(Long locationId);

    List<ServiceTerm> findAllByLocationId(Long locationId);
}
