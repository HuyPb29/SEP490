package com.sep490.bms.repository.location;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;

import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.ServiceRegistration;

/**
 * Tra cứu đơn đăng ký sử dụng dịch vụ theo người gửi và trạng thái xét duyệt.
 */
@Repository
public interface ServiceRegistrationRepository extends JpaRepository<ServiceRegistration, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ServiceRegistration r where r.id = :id")
    Optional<ServiceRegistration> findByIdForUpdate(@Param("id") Long id);

    boolean existsByRequesterIdIsNullAndStatusAndContactEmailIgnoreCase(ApprovalStatus status, String email);

    boolean existsByRequesterIdIsNullAndStatusAndContactPhone(ApprovalStatus status, String phone);

    /** UC05 - Đơn của một owner, đơn mới nhất lên đầu. */
    List<ServiceRegistration> findAllByRequesterIdOrderByCreatedAtDescIdDesc(Long requesterId);

    List<ServiceRegistration> findAllByRequesterIdAndStatusOrderByCreatedAtDescIdDesc(
            Long requesterId, ApprovalStatus status);

    /** UC05 - Hàng đợi duyệt của admin. */
    List<ServiceRegistration> findAllByOrderByCreatedAtDescIdDesc();

    List<ServiceRegistration> findAllByStatusOrderByCreatedAtDescIdDesc(ApprovalStatus status);
}
