package com.sep490.bms.repository.reschedule;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.reschedule.RefundRequest;

@Repository
public interface RefundRequestRepository extends JpaRepository<RefundRequest, Long> {
}
