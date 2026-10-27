package com.sep490.bms.controller.reschedule;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.dto.request.OwnerCancellationRequest;

import jakarta.validation.Valid;

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
    @PreAuthorize("hasRole('PLAYER')")
    @PostMapping("/api/bookings/{id}/cancel")
    public ResponseEntity<Void> postBookingsByIdCancel(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @PostMapping("/api/owner/bookings/{id}/cancel")
    public ResponseEntity<Void> ownerCancel(@PathVariable("id") Long id, @Valid @RequestBody OwnerCancellationRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
