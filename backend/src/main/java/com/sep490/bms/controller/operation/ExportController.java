package com.sep490.bms.controller.operation;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F9 – Vận hành và báo cáo
 * Owner: Hoàng
 * UC: UC36 – Tải dữ liệu quản lý địa điểm
 */
@RestController
public class ExportController {

    /**
     * UC36 – Tải dữ liệu quản lý địa điểm
     * Feature: F9 – Vận hành và báo cáo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/exports")
    public ResponseEntity<Void> getOwnerExports() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

}
