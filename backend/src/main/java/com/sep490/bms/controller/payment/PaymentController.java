package com.sep490.bms.controller.payment;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F4 – Thanh toán
 * Owner: Minh
 * UC: UC18 – Thanh toán booking; UC19 – Xác nhận thanh toán
 */
@RestController
public class PaymentController {

    /**
     * UC18 – Thanh toán booking
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/payments/{id}")
    public ResponseEntity<Void> getPaymentsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC18 – Thanh toán booking
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/bookings/{id}/payment-instructions")
    public ResponseEntity<Void> getPaymentsByIdPaymentInstructions(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC18 – Thanh toán booking
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/bookings/{id}/payments")
    public ResponseEntity<Void> postPaymentsByIdSubmit(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC18 – Thanh toán booking
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/payments/{id}/resubmit")
    public ResponseEntity<Void> postPaymentsByIdResubmit(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC19 – Xác nhận thanh toán
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/payments")
    public ResponseEntity<Void> getStaffPayments() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC19 – Xác nhận thanh toán
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/payments/{id}")
    public ResponseEntity<Void> getStaffPaymentsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC19 – Xác nhận thanh toán
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/payments/{id}/confirm")
    public ResponseEntity<Void> postStaffPaymentsByIdConfirm(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC19 – Xác nhận thanh toán
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/payments/{id}/reject")
    public ResponseEntity<Void> postStaffPaymentsByIdReject(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC19 – Xác nhận thanh toán
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/payments/{id}/request-resubmission")
    public ResponseEntity<Void> postStaffPaymentsByIdRequestResubmission(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @GetMapping("/api/reschedule-requests/{id}/payment-instructions")
    public ResponseEntity<Void> rescheduleInstructions(@PathVariable("id") Long id) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @PostMapping("/api/reschedule-requests/{id}/payments")
    public ResponseEntity<Void> submitReschedulePayment(@PathVariable("id") Long id) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @GetMapping("/api/booking-packages/{id}/payment-instructions")
    public ResponseEntity<Void> packagePaymentinstructions(@PathVariable("id") Long id) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @PostMapping("/api/booking-packages/{id}/payments")
    public ResponseEntity<Void> packagePayments(@PathVariable("id") Long id) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
