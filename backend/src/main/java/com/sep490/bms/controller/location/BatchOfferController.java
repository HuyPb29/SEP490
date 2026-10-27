package com.sep490.bms.controller.location;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
 */
@RestController
public class BatchOfferController {

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/batch-offers")
    public ResponseEntity<Void> getOwnerBatchOffers() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/batch-offers")
    public ResponseEntity<Void> postOwnerBatchOffers() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/owner/batch-offers/{id}")
    public ResponseEntity<Void> patchOwnerBatchOffersById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @DeleteMapping("/api/owner/batch-offers/{id}")
    public ResponseEntity<Void> deleteOwnerBatchOffersById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @GetMapping("/api/locations/{id}/batch-offers")
    public ResponseEntity<Void> publicBatchOffers(@PathVariable("id") Long id) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
