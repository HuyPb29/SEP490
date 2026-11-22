package com.sep490.bms.repository.location;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import com.sep490.bms.entity.location.ServiceRenewal;
import com.sep490.bms.entity.enums.ApprovalStatus;

public interface ServiceRenewalRepository extends JpaRepository<ServiceRenewal, Long> {
    boolean existsByLocationIdAndStatus(Long locationId, ApprovalStatus status);
    List<ServiceRenewal> findAllByLocationIdOrderByCreatedAtDescIdDesc(Long locationId);
    List<ServiceRenewal> findAllByOrderByCreatedAtDescIdDesc();
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ServiceRenewal r where r.id=:id")
    Optional<ServiceRenewal> findByIdForUpdate(@Param("id") Long id);
}
