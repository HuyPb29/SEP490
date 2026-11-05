package com.sep490.bms.repository.location;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.ServiceRegistration;

@Repository
public interface ServiceRegistrationRepository extends JpaRepository<ServiceRegistration, Long> {

    /** UC05 - Đơn của một owner, đơn mới nhất lên đầu. */
    List<ServiceRegistration> findAllByRequesterIdOrderByCreatedAtDescIdDesc(Long requesterId);

    List<ServiceRegistration> findAllByRequesterIdAndStatusOrderByCreatedAtDescIdDesc(
            Long requesterId, ApprovalStatus status);

    /** UC05 - Hàng đợi duyệt của admin. */
    List<ServiceRegistration> findAllByOrderByCreatedAtDescIdDesc();

    List<ServiceRegistration> findAllByStatusOrderByCreatedAtDescIdDesc(ApprovalStatus status);
}
