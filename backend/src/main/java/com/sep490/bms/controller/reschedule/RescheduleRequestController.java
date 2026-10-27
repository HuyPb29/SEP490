package com.sep490.bms.controller.reschedule;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.dto.request.ReschedulePreviewRequest;

import jakarta.validation.Valid;

/**
 * Feature: F5 – Đổi lịch, hủy và hoàn tiền
 * Owner: Huy
 * UC: UC21 – Đổi lịch booking
 */
@RestController
public class RescheduleRequestController {

    /**
     * UC21 – Đổi lịch booking
     * Feature: F5 – Đổi lịch, hủy và hoàn tiền
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/bookings/{id}/reschedule-requests")
    public ResponseEntity<Void> postBookingsByIdRescheduleRequests(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC21 – Đổi lịch booking
     * Feature: F5 – Đổi lịch, hủy và hoàn tiền
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/bookings/{id}/reschedule-requests")
    public ResponseEntity<Void> getBookingsByIdRescheduleRequests(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC21 – Đổi lịch booking
     * Feature: F5 – Đổi lịch, hủy và hoàn tiền
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/reschedule-requests/{id}")
    public ResponseEntity<Void> getRescheduleRequestsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @PostMapping("/api/bookings/{id}/reschedule-requests/preview")
    public ResponseEntity<Void> previewReschedule(@PathVariable("id") Long id, @Valid @RequestBody ReschedulePreviewRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
