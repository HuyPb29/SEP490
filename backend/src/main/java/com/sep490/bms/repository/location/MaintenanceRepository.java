package com.sep490.bms.repository.location;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.Maintenance;

@Repository
public interface MaintenanceRepository extends JpaRepository<Maintenance, Long> {

    /** Bảo trì có trạng thái {@code status} giao với khoảng [from, to). */
    List<Maintenance> findByCourtIdInAndStatusAndStartAtLessThanAndEndAtGreaterThan(
            Collection<Long> courtIds, ApprovalStatus status, LocalDateTime to, LocalDateTime from);
}
