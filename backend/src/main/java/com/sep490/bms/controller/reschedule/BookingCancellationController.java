package com.sep490.bms.controller.reschedule;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F5 – Đổi lịch, hủy và hoàn tiền
 * Owner: Huy
 * UC: UC22 – Hủy booking và xử lý booking bị ảnh hưởng
 */
@RestController
public class BookingCancellationController {

    /**
     * UC22 – Hủy booking và xử lý booking bị ảnh hưởng
     * Feature: F5 – Đổi lịch, hủy và hoàn tiền
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/bookings/{id}/cancel")
    public ResponseEntity<Void> postBookingsByIdCancel(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
