package com.sep490.bms.repository.payment;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
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

    /** Payment của một booking; mỗi booking có nhiều nhất một dòng (ux_payment_booking). */
    Optional<Payment> findByBookingId(Long bookingId);

    /** Payment của nhiều booking, đọc một lần cho một trang danh sách (UC16). */
    List<Payment> findByBookingIdIn(Collection<Long> bookingIds);

    /** Payment của một gói; mỗi gói có nhiều nhất một dòng (ux_payment_package). */
    Optional<Payment> findByPackageId(Long packageId);

    /**
     * UC19 #1, FR58: giao dịch của booking lẻ và gói đặt nhiều buổi tại một địa điểm theo trạng thái, gửi sớm
     * nhất lên đầu để Staff xử lý theo thứ tự. Khoản trả thêm khi đổi lịch (UC21) có màn riêng nên không lấy.
     */
    Page<Payment> findByLocationIdAndStatusAndRescheduleRequestIdIsNullOrderBySubmittedAtAscIdAsc(
            Long locationId, PaymentStatus status, Pageable pageable);

    /**
     * UC20 #1, FR61: tổng các giao dịch có trạng thái status của địa điểm, xác nhận trong [from, to).
     * Doanh thu ghi vào ngày xác nhận (BR37), nên lọc theo confirmed_at. Lấy mọi loại giao dịch
     * (booking lẻ, gói, trả thêm khi đổi lịch, tại quầy), vì tiền của loại nào cũng về cùng tài khoản.
     */
    @Query("""
            SELECT new com.sep490.bms.repository.payment.ConfirmedPaymentTotal(
                COUNT(p), SUM(p.amountDue), SUM(COALESCE(p.receivedAmount, p.amountDue)))
            FROM Payment p
            WHERE p.locationId = :locationId AND p.status = :status
              AND p.confirmedAt >= :from AND p.confirmedAt < :to
            """)
    ConfirmedPaymentTotal sumByConfirmedAt(@Param("locationId") Long locationId,
            @Param("status") PaymentStatus status,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);
}
