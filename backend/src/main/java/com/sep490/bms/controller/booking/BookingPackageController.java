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
 * UC: UC15 – Đặt nhiều buổi; UC17 – Xem lịch sử booking
 */
@RestController
public class BookingPackageController {

    /**
     * UC15 – Đặt nhiều buổi (#4, #5, #6, #9, #10: lịch toàn kỳ, buổi trùng, tổng tiền, chương trình theo lô; không lưu gì)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/booking-packages/preview")
    public ResponseEntity<Void> postBookingPackagesPreview() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC15 – Đặt nhiều buổi (#8, #11: tạo gói và các buổi con, giữ chỗ 15 phút)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/booking-packages")
    public ResponseEntity<Void> postBookingPackages() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC15 – Đặt nhiều buổi
     * UC17 – Xem lịch sử booking
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/booking-packages/{id}")
    public ResponseEntity<Void> getBookingPackagesById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC17 – Xem lịch sử booking
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/me/booking-packages")
    public ResponseEntity<Void> getMeBookingPackages() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
