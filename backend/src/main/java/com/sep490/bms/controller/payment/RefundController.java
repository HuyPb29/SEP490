package com.sep490.bms.controller.payment;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F5 – Đổi lịch, hủy và hoàn tiền
 * Owner: Huy
 * UC: UC23 – Ghi nhận hoàn tiền
 */
@RestController
public class RefundController {

    /**
     * UC23 – Ghi nhận hoàn tiền
     * Feature: F5 – Đổi lịch, hủy và hoàn tiền
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/refunds")
    public ResponseEntity<Void> getStaffRefunds() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC23 – Ghi nhận hoàn tiền
     * Feature: F5 – Đổi lịch, hủy và hoàn tiền
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/refunds/{id}")
    public ResponseEntity<Void> getStaffRefundsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC23 – Ghi nhận hoàn tiền
     * Feature: F5 – Đổi lịch, hủy và hoàn tiền
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/refunds/{id}/record")
    public ResponseEntity<Void> postStaffRefundsByIdRecord(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
