package com.sep490.bms.repository.location;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.location.PriceRule;

@Repository
public interface PriceRuleRepository extends JpaRepository<PriceRule, Long> {

    /** Bảng giá của một sân, sắp theo giờ bắt đầu để dễ đối chiếu trên màn hình quản lý. */
    List<PriceRule> findAllByCourtIdOrderByStartMinuteAsc(Long courtId);
}
