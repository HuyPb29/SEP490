package com.sep490.bms.repository.location;

import java.util.List;
import java.util.Optional;
import com.sep490.bms.entity.location.CourtExpansion;
import com.sep490.bms.entity.enums.ApprovalStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;

public interface CourtExpansionRepository extends JpaRepository<CourtExpansion, Long> {
    List<CourtExpansion> findAllByLocationIdOrderByCreatedAtDescIdDesc(Long locationId);
    List<CourtExpansion> findAllByOrderByCreatedAtDescIdDesc();
    boolean existsByLocationIdAndStatus(Long locationId, ApprovalStatus status);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CourtExpansion r where r.id = :id")
    Optional<CourtExpansion> findByIdForUpdate(Long id);
}
