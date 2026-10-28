package com.sep490.bms.controller.location;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC08 – Quản lý giờ mở cửa và slot
 */
@RestController
public class SlotSettingController {

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/courts/{id}/slot-settings")
    public ResponseEntity<Void> getOwnerCourtsByIdSlotSettings(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @PutMapping("/api/owner/courts/{id}/slot-settings")
    public ResponseEntity<Void> putOwnerCourtsByIdSlotSettings(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
