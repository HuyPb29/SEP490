package com.sep490.bms.controller.location;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC06 – Quản lý địa điểm sử dụng dịch vụ; UC07 – Quản lý địa điểm và sân
 */
@RestController
public class LocationManagementController {

    /**
     * UC06 – Quản lý địa điểm sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/admin/locations")
    public ResponseEntity<Void> getAdminLocations() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC06 – Quản lý địa điểm sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/admin/locations/{id}")
    public ResponseEntity<Void> getAdminLocationsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC06 – Quản lý địa điểm sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/admin/locations/{id}")
    public ResponseEntity<Void> patchAdminLocationsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC07 – Quản lý địa điểm và sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/locations")
    public ResponseEntity<Void> getOwnerLocations() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC07 – Quản lý địa điểm và sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/owner/locations/{id}")
    public ResponseEntity<Void> patchOwnerLocationsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
