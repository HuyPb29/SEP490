package com.sep490.bms.controller.promotion;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F6 – Ưu đãi
 * Owner: Huy
 * UC: UC24 – Quản lý và sử dụng voucher
 */
@RestController
public class VoucherController {

    /**
     * UC24 – Quản lý và sử dụng voucher
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/locations/{id}/vouchers")
    public ResponseEntity<Void> getLocationsByIdVouchers(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC24 – Quản lý và sử dụng voucher
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/me/vouchers")
    public ResponseEntity<Void> getMeVouchers() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC24 – Quản lý và sử dụng voucher
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/vouchers")
    public ResponseEntity<Void> postOwnerVouchers() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC24 – Quản lý và sử dụng voucher
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/owner/vouchers/{id}")
    public ResponseEntity<Void> patchOwnerVouchersById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC24 – Quản lý và sử dụng voucher
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/vouchers/{id}/publish")
    public ResponseEntity<Void> postOwnerVouchersByIdPublish(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC24 – Quản lý và sử dụng voucher
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/vouchers/{id}/disable")
    public ResponseEntity<Void> postOwnerVouchersByIdDisable(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC24 – Quản lý và sử dụng voucher
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/bookings/{id}/apply-voucher")
    public ResponseEntity<Void> postBookingsByIdApplyVoucher(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
