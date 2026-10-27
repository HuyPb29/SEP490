package com.sep490.bms.repository.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.payment.PaymentProof;

@Repository
public interface PaymentProofRepository extends JpaRepository<PaymentProof, Long> {
}
