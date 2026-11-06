package com.sep490.bms.repository.payment;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.enums.PaymentStatus;
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

    /**
     * UC19 #1, FR58: giao dịch của booking lẻ tại một địa điểm theo trạng thái, gửi sớm nhất lên đầu
     * để Staff xử lý theo thứ tự. Thanh toán gói (UC15) và khoản trả thêm khi đổi lịch (UC21) chưa làm
     * nên chỉ lấy dòng có booking_id.
     */
    @Query("select p from Payment p where p.locationId=:locationId and p.status=:status and (p.bookingId is not null or p.packageId is not null) order by p.submittedAt,p.id")
    Page<Payment> findPendingBookingPayments(
            Long locationId, PaymentStatus status, Pageable pageable);
}
