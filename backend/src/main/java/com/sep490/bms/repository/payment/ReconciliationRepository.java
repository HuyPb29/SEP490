package com.sep490.bms.repository.payment;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.payment.Reconciliation;

@Repository
public interface ReconciliationRepository extends JpaRepository<Reconciliation, Long> {

    /** UC20: mỗi địa điểm đối soát mỗi ngày một lần (unique ux_recon_day). */
    Optional<Reconciliation> findByLocationIdAndReconDate(Long locationId, LocalDate reconDate);

    boolean existsByLocationIdAndReconDate(Long locationId, LocalDate reconDate);

    /**
     * UC20 #5: kết quả đối soát của địa điểm, ngày mới nhất lên đầu. from, to để trống thì không giới hạn
     * phía đó.
     */
    @Query("""
            SELECT r FROM Reconciliation r
            WHERE r.locationId = :locationId
              AND (:from IS NULL OR r.reconDate >= :from)
              AND (:to IS NULL OR r.reconDate <= :to)
            ORDER BY r.reconDate DESC
            """)
    Page<Reconciliation> findForLocation(@Param("locationId") Long locationId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            Pageable pageable);
}
