package com.sep490.bms.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.OtpPurpose;
import com.sep490.bms.entity.OtpRequest;

@Repository
public interface OtpRequestRepository extends JpaRepository<OtpRequest, Long> {

    @Query(value = """
            SELECT COUNT(*) FROM otp_request
            WHERE purpose = 'REGISTER' AND used_at IS NULL AND expires_at > :now
              AND (email = :email OR JSON_VALUE(pending_data, '$.phone') = :phone)
              AND (:excludeOwn = 0 OR email <> :email)
            """, nativeQuery = true)
    long countActiveReservations(@Param("email") String email, @Param("phone") String phone,
            @Param("now") java.time.LocalDateTime now, @Param("excludeOwn") int excludeOwn);

    long countByEmailAndCreatedAtAfter(String email, java.time.LocalDateTime since);

    @Modifying(flushAutomatically = true)
    @Query("UPDATE OtpRequest o SET o.usedAt = :now WHERE o.email = :email AND o.purpose = :purpose AND o.usedAt IS NULL")
    int invalidateUnused(@Param("email") String email, @Param("purpose") OtpPurpose purpose,
            @Param("now") java.time.LocalDateTime now);

    Optional<OtpRequest> findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(String email, OtpPurpose purpose);
}
