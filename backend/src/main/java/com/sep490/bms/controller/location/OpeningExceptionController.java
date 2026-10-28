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
 * UC: UC08 – Quản lý giờ mở cửa và slot
 */
@RestController
public class OpeningExceptionController {

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/locations/{id}/opening-exceptions")
    public ResponseEntity<Void> getOwnerLocationsByIdOpeningExceptions(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/locations/{id}/opening-exceptions")
    public ResponseEntity<Void> postOwnerLocationsByIdOpeningExceptions(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/owner/opening-exceptions/{id}")
    public ResponseEntity<Void> patchOwnerOpeningExceptionsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: NOT_IMPLEMENTED
     */
    @DeleteMapping("/api/owner/opening-exceptions/{id}")
    public ResponseEntity<Void> deleteOwnerOpeningExceptionsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
