package com.sep490.bms.controller.operation;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.CreateMaintenanceRequest;
import com.sep490.bms.dto.location.MaintenanceRequestDto;
import com.sep490.bms.dto.location.RejectMaintenanceRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.MaintenanceService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC10 – Quản lý bảo trì sân
 */
@RestController
@RequiredArgsConstructor
public class MaintenanceRequestController {

    private final MaintenanceService maintenanceService;

    /**
     * UC10 – Quản lý bảo trì sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/staff/maintenance-requests")
    public ResponseEntity<ApiResponse<List<MaintenanceRequestDto>>> getStaffMaintenanceRequests(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(name = "status", required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(maintenanceService.list(currentUser, status)));
    }

    /**
     * UC10 – Quản lý bảo trì sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/staff/maintenance-requests")
    public ResponseEntity<ApiResponse<MaintenanceRequestDto>> postStaffMaintenanceRequests(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody CreateMaintenanceRequest request) {
        MaintenanceRequestDto created = maintenanceService.create(currentUser, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Gửi yêu cầu bảo trì thành công", created));
    }

    /**
     * UC10 – Quản lý bảo trì sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/staff/maintenance-requests/{id}")
    public ResponseEntity<ApiResponse<MaintenanceRequestDto>> getStaffMaintenanceRequestsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(maintenanceService.detail(currentUser, id)));
    }

    /**
     * UC10 – Quản lý bảo trì sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/owner/maintenance-requests")
    public ResponseEntity<ApiResponse<List<MaintenanceRequestDto>>> getOwnerMaintenanceRequests(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(name = "status", required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(maintenanceService.list(currentUser, status)));
    }

    /**
     * UC10 – Quản lý bảo trì sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/owner/maintenance-requests/{id}")
    public ResponseEntity<ApiResponse<MaintenanceRequestDto>> getOwnerMaintenanceRequestsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(maintenanceService.detail(currentUser, id)));
    }

    /**
     * UC10 – Quản lý bảo trì sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/owner/maintenance-requests/{id}/approve")
    public ResponseEntity<ApiResponse<MaintenanceRequestDto>> postOwnerMaintenanceRequestsByIdApprove(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        MaintenanceRequestDto approved = maintenanceService.approve(currentUser, id);
        return ResponseEntity.ok(ApiResponse.success("Đã duyệt yêu cầu bảo trì", approved));
    }

    /**
     * UC10 – Quản lý bảo trì sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/owner/maintenance-requests/{id}/reject")
    public ResponseEntity<ApiResponse<MaintenanceRequestDto>> postOwnerMaintenanceRequestsByIdReject(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody RejectMaintenanceRequest request) {
        MaintenanceRequestDto rejected = maintenanceService.reject(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Đã từ chối yêu cầu bảo trì", rejected));
    }
}
