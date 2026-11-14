package com.sep490.bms.repository.promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import com.sep490.bms.entity.promotion.LoyaltyAccrual;
/**
 * Tra cứu lần cộng điểm theo mã giao dịch để tránh cộng điểm nhiều lần.
 */
public interface LoyaltyAccrualRepository extends JpaRepository<LoyaltyAccrual,Long> {
 boolean existsByPaymentId(Long paymentId);
 java.util.Optional<LoyaltyAccrual> findByPaymentId(Long paymentId);
}
