package com.sep490.bms.repository.feedback;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.enums.ComplaintStatus;
import com.sep490.bms.entity.feedback.Complaint;

@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, Long> {

    Page<Complaint> findByCreatedBy(Long createdBy, Pageable pageable);

    boolean existsByPaymentIdAndComplaintType(Long paymentId, String complaintType);

    @Query("SELECT c FROM Complaint c WHERE c.locationId = :locationId"
            + " AND (:status IS NULL OR c.status = :status)"
            + " AND (:excluded IS NULL OR c.status <> :excluded)")
    Page<Complaint> findByLocation(@Param("locationId") Long locationId,
            @Param("status") ComplaintStatus status, @Param("excluded") ComplaintStatus excluded,
            Pageable pageable);
}
