package com.sep490.bms.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.OtpPurpose;
import com.sep490.bms.entity.OtpRequest;

@Repository
public interface OtpRequestRepository extends JpaRepository<OtpRequest, Long> {

    Optional<OtpRequest> findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(String email, OtpPurpose purpose);
}
