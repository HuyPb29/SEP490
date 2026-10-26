package com.sep490.bms.controller.booking;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F6 – Ưu đãi
 * Owner: Huy
 * UC: UC24 – Quản lý và sử dụng voucher; UC25 – Tích điểm và dùng điểm
 */
@RestController
public class BookingQuoteController {

    /**
     * UC24 – Quản lý và sử dụng voucher
     * UC25 – Tích điểm và dùng điểm
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/booking-quotes")
    public ResponseEntity<Void> postBookingQuotes() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
