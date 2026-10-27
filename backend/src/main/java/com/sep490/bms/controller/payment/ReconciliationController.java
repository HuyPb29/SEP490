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
 * UC: UC20 – Đối soát doanh thu cuối ngày
 */
@RestController
public class ReconciliationController {

    /**
     * UC20 – Đối soát doanh thu cuối ngày
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/reconciliations")
    public ResponseEntity<Void> getStaffReconciliations() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC20 – Đối soát doanh thu cuối ngày
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/reconciliations/{id}")
    public ResponseEntity<Void> getStaffReconciliationsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC20 – Đối soát doanh thu cuối ngày
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/reconciliations")
    public ResponseEntity<Void> postStaffReconciliations() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
