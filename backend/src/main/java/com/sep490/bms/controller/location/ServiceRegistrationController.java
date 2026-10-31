package com.sep490.bms.controller.location;

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
import com.sep490.bms.dto.location.CreateServiceRegistrationRequest;
import com.sep490.bms.dto.location.RejectServiceRegistrationRequest;
import com.sep490.bms.dto.location.ServiceRegistrationDto;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.ServiceRegistrationService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC05 – Đăng ký sử dụng dịch vụ
 */
@RestController
@RequiredArgsConstructor
public class ServiceRegistrationController {

    private final ServiceRegistrationService serviceRegistrationService;

    /**
     * UC05 – Đăng ký sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/service-registrations")
    public ResponseEntity<ApiResponse<ServiceRegistrationDto>> postServiceRegistrations(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody CreateServiceRegistrationRequest request) {
        ServiceRegistrationDto created = serviceRegistrationService.submit(currentUser, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Gửi đơn đăng ký thành công", created));
    }

    /**
     * UC05 – Đăng ký sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     *
     * Lọc tuỳ chọn: ?status=PENDING|APPROVED|REJECTED
     */
    @GetMapping("/api/me/service-registrations")
    public ResponseEntity<ApiResponse<List<ServiceRegistrationDto>>> getMeServiceRegistrations(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(
                serviceRegistrationService.listMine(currentUser, status)));
    }

    /**
     * UC05 – Đăng ký sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     *
     * Lọc tuỳ chọn: ?status=PENDING|APPROVED|REJECTED
     */
    @GetMapping("/api/admin/service-registrations")
    public ResponseEntity<ApiResponse<List<ServiceRegistrationDto>>> getAdminServiceRegistrations(
            @RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(serviceRegistrationService.listForAdmin(status)));
    }

    /**
     * UC05 – Đăng ký sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/admin/service-registrations/{id}/approve")
    public ResponseEntity<ApiResponse<ServiceRegistrationDto>> postAdminServiceRegistrationsByIdApprove(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        ServiceRegistrationDto approved = serviceRegistrationService.approve(currentUser, id);
        return ResponseEntity.ok(ApiResponse.success("Duyệt đơn đăng ký thành công", approved));
    }

    /**
     * UC05 – Đăng ký sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/admin/service-registrations/{id}/reject")
    public ResponseEntity<ApiResponse<ServiceRegistrationDto>> postAdminServiceRegistrationsByIdReject(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody RejectServiceRegistrationRequest request) {
        ServiceRegistrationDto rejected = serviceRegistrationService.reject(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Đã từ chối đơn đăng ký", rejected));
    }
}
