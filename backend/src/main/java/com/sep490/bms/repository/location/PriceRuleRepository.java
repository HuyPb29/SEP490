package com.sep490.bms.repository.location;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.PriceRule;

@Repository
public interface PriceRuleRepository extends JpaRepository<PriceRule, Long> {

    /** Mức giá còn hiệu lực vào ngày {@code date}; chưa lọc theo thứ (apply_days). */
    @Query("SELECT p FROM PriceRule p WHERE p.courtId IN :courtIds AND p.validFrom <= :date "
            + "AND (p.validTo IS NULL OR p.validTo >= :date)")
    List<PriceRule> findValidOn(@Param("courtIds") Collection<Long> courtIds, @Param("date") LocalDate date);
}
