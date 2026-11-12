package com.sep490.bms.repository.account;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.account.OtpPurpose;
import com.sep490.bms.entity.account.OtpRequest;

/**
 * Tra cứu OTP mới nhất, đếm lượt gửi và vô hiệu hóa mã hoặc đăng ký chờ.
 */
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

    @Query("select o.createdAt from OtpRequest o where o.email = :email and o.createdAt > :since order by o.createdAt desc")
    List<LocalDateTime> findRecentSendTimes(@Param("email") String email, @Param("since") LocalDateTime since, Pageable limit);

    @Modifying(flushAutomatically=true)
    @Query("update OtpRequest o set o.pendingData=null,o.usedAt=coalesce(o.usedAt,:now) where o.email=:email and o.purpose=com.sep490.bms.entity.account.OtpPurpose.REGISTER")
    int discardRegistration(@Param("email") String email,@Param("now") java.time.LocalDateTime now);

    @Modifying(flushAutomatically = true)
    @Query("UPDATE OtpRequest o SET o.usedAt = :now WHERE o.email = :email AND o.purpose = :purpose AND o.usedAt IS NULL")
    int invalidateUnused(@Param("email") String email, @Param("purpose") OtpPurpose purpose,
            @Param("now") java.time.LocalDateTime now);

    Optional<OtpRequest> findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(String email, OtpPurpose purpose);
}
