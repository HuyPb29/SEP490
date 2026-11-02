package com.sep490.bms.repository.promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import com.sep490.bms.entity.promotion.LoyaltyAccrual;
public interface LoyaltyAccrualRepository extends JpaRepository<LoyaltyAccrual,Long> { boolean existsByPaymentId(Long paymentId); }
