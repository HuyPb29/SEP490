package com.sep490.bms.controller.operation;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F9 – Vận hành và báo cáo
 * Owner: Hoàng
 * UC: UC34 – Xem bảng điều hành nhân viên
 */
@RestController
public class DashboardController {

    /**
     * UC34 – Xem bảng điều hành nhân viên
     * Feature: F9 – Vận hành và báo cáo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/dashboards/me")
    public ResponseEntity<Void> getStaffDashboardsMe() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
