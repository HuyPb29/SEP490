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
public class PriceRuleController {

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/courts/{id}/price-rules")
    public ResponseEntity<Void> getOwnerCourtsByIdPriceRules(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/courts/{id}/price-rules")
    public ResponseEntity<Void> postOwnerCourtsByIdPriceRules(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/owner/price-rules/{id}")
    public ResponseEntity<Void> patchOwnerPriceRulesById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @DeleteMapping("/api/owner/price-rules/{id}")
    public ResponseEntity<Void> deleteOwnerPriceRulesById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
