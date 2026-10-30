package com.sep490.bms.entity.promotion;
import java.math.BigDecimal;
import jakarta.persistence.*;
import lombok.*;
/** Receipt keyed by payment, including zero-point payments, prevents duplicate accrual. */
@Entity @Table(name="loyalty_accrual") @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LoyaltyAccrual {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="payment_id",nullable=false) private Long paymentId;
 @Column(name="balance_id",nullable=false) private Long balanceId;
 @Column(name="paid_amount",nullable=false,precision=12,scale=0) private BigDecimal paidAmount;
 @Column(name="earned_points",nullable=false) private int earnedPoints;
 @Column(name="earning_rate",nullable=false) private int earningRate;
}
