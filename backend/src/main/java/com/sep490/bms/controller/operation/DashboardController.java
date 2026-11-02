package com.sep490.bms.controller.operation;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.operation.StaffDashboardResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.operation.OperationService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F9 – Vận hành và báo cáo
 * Owner: Hoàng
 * UC: UC34 – Xem bảng điều hành nhân viên
 */
@RestController
@RequiredArgsConstructor
public class DashboardController {

    private final OperationService operationService;

    @GetMapping("/api/staff/dashboards/me")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse<StaffDashboardResponse>> getStaffDashboardsMe(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(operationService.getStaffDashboard(currentUser)));
    }
}
