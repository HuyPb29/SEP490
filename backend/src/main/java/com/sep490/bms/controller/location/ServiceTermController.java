package com.sep490.bms.controller.location;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC06 – Quản lý địa điểm sử dụng dịch vụ
 */
@RestController
public class ServiceTermController {

    /**
     * UC06 – Quản lý địa điểm sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/admin/locations/{id}/service-terms")
    public ResponseEntity<Void> getAdminLocationsByIdServiceTerms(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC06 – Quản lý địa điểm sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/admin/locations/{id}/service-terms")
    public ResponseEntity<Void> postAdminLocationsByIdServiceTerms(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
