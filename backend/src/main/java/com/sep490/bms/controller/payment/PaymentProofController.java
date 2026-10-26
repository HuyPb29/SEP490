package com.sep490.bms.controller.payment;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F4 – Thanh toán
 * Owner: Minh
 * UC: UC18 – Thanh toán booking
 */
@RestController
public class PaymentProofController {

    /**
     * UC18 – Thanh toán booking
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/payments/{id}/proofs")
    public ResponseEntity<Void> postPaymentsByIdProofs(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
