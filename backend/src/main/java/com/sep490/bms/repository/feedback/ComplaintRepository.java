package com.sep490.bms.repository.feedback;

import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.enums.ComplaintStatus;
import com.sep490.bms.entity.feedback.Complaint;

/**
 * Truy vấn khiếu nại theo người gửi hoặc địa điểm và khóa bản ghi khi xử lý.
 */
@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, Long> {

    /** Serialize decisions and their refund/point side effects in the service transaction. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Complaint c WHERE c.id = :id")
    Optional<Complaint> findByIdForUpdate(@Param("id") Long id);

    Page<Complaint> findByCreatedBy(Long createdBy, Pageable pageable);

    /** Job P33: khiếu nại đang chờ Owner để xét quá hạn xử lý. */
    java.util.List<Complaint> findByStatus(ComplaintStatus status);

    boolean existsByPaymentIdAndComplaintType(Long paymentId, String complaintType);

    @Query("SELECT c FROM Complaint c WHERE c.locationId = :locationId"
            + " AND (:status IS NULL OR c.status = :status)"
            + " AND (:excluded IS NULL OR c.status <> :excluded)")
    Page<Complaint> findByLocation(@Param("locationId") Long locationId,
            @Param("status") ComplaintStatus status, @Param("excluded") ComplaintStatus excluded,
            Pageable pageable);
}
