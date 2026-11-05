package com.sep490.bms.repository.payment;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.payment.Reconciliation;

@Repository
public interface ReconciliationRepository extends JpaRepository<Reconciliation, Long> {

    /** UC20: mỗi địa điểm đối soát mỗi ngày một lần (unique ux_recon_day). */
    Optional<Reconciliation> findByLocationIdAndReconDate(Long locationId, LocalDate reconDate);

    boolean existsByLocationIdAndReconDate(Long locationId, LocalDate reconDate);
}
