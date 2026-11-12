package com.sep490.bms.repository.payment;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.payment.PaymentProof;

/**
 * Tra cứu các ảnh chứng từ của giao dịch theo thứ tự tải lên mới nhất.
 */
@Repository
public interface PaymentProofRepository extends JpaRepository<PaymentProof, Long> {

    /** UC19 #2: mọi ảnh chứng từ của một giao dịch, ảnh mới gửi lên đầu (ảnh cũ vẫn giữ, FR54). */
    List<PaymentProof> findByPaymentIdOrderByUploadedAtDescIdDesc(Long paymentId);
}
