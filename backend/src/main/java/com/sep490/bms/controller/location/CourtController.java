package com.sep490.bms.controller.location;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F3 – Tìm và đặt sân
 * Owner: Minh
 * UC: UC12 – Xem thông tin sân công khai
 */
@RestController
public class CourtController {

    /**
     * UC12 – Xem thông tin sân công khai
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/locations/{id}/courts")
    public ResponseEntity<Void> getLocationsByIdCourts(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC12 – Xem thông tin sân công khai
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/courts/{id}")
    public ResponseEntity<Void> getCourtsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
