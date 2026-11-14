package com.sep490.bms.repository.reschedule;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.reschedule.RescheduleRequest;

/**
 * Truy cập các bản ghi yêu cầu đổi lịch.
 */
@Repository
public interface RescheduleRequestRepository extends JpaRepository<RescheduleRequest, Long> {
}
