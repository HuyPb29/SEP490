package com.sep490.bms.repository.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.payment.Payment;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
}
