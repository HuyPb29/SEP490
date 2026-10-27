package com.sep490.bms.controller.booking;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F3 – Tìm và đặt sân
 * Owner: Minh
 * UC: UC14 – Đặt sân lẻ; UC16 – Đặt sân tại quầy; UC17 – Xem lịch sử booking
 */
@RestController
public class BookingController {

    /**
     * UC14 – Đặt sân lẻ (#1–5: màn tóm tắt, áp voucher và điểm; không lưu gì)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/bookings/summary")
    public ResponseEntity<Void> postBookingsSummary() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC14 – Đặt sân lẻ (#6–8: body gồm voucherCode, pointsToUse; trừ lượt/điểm khi tạo booking)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/bookings")
    public ResponseEntity<Void> postBookings() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC14 – Đặt sân lẻ
     * UC17 – Xem lịch sử booking
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/bookings/{id}")
    public ResponseEntity<Void> getBookingsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC16 – Đặt sân tại quầy
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/bookings")
    public ResponseEntity<Void> postStaffBookings() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC16 – Đặt sân tại quầy
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/bookings")
    public ResponseEntity<Void> getStaffBookings() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC16 – Đặt sân tại quầy (#3: Staff thấy tiền đã về thì xác nhận; không có ảnh chứng từ)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/bookings/{id}/confirm")
    public ResponseEntity<Void> postStaffBookingsByIdConfirm(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC17 – Xem lịch sử booking
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/me/bookings")
    public ResponseEntity<Void> getMeBookings() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
