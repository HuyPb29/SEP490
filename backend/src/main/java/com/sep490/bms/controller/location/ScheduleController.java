package com.sep490.bms.controller.location;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import java.time.LocalDate;

/**
 * Feature: F3 – Tìm và đặt sân
 * Owner: Minh
 * UC: UC13 – Xem lịch sân
 */
@RestController
public class ScheduleController {

    /**
     * UC13 – Xem lịch sân (?date=; lịch theo ngày của cả địa điểm: mỗi hàng một sân, mỗi cột một slot)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/locations/{id}/schedules")
    public ResponseEntity<Void> getLocationsByIdSchedules(@PathVariable("id") String id, @RequestParam LocalDate date) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
