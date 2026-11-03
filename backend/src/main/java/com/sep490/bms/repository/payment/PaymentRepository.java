package com.sep490.bms.repository.payment;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.payment.Payment;

import jakarta.persistence.LockModeType;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    /**
     * Đọc và khóa dòng payment đến hết giao dịch. Player gửi lại chứng từ và Staff xử lý cùng lúc
     * thì người sau phải chờ, rồi thấy trạng thái đã đổi (FR56).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.id = :id")
    Optional<Payment> findByIdForUpdate(@Param("id") Long id);
}
