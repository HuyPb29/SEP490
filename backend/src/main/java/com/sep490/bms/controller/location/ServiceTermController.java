package com.sep490.bms.controller.location;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.CreateServiceTermRequest;
import com.sep490.bms.dto.location.ServiceTermDto;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.ServiceTermService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC06 – Quản lý địa điểm sử dụng dịch vụ
 */
@RestController
@RequiredArgsConstructor
public class ServiceTermController {

    private final ServiceTermService serviceTermService;

    /**
     * UC06 – Quản lý địa điểm sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/admin/locations/{id}/service-terms")
    public ResponseEntity<ApiResponse<List<ServiceTermDto>>> getAdminLocationsByIdServiceTerms(
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(serviceTermService.list(id)));
    }

    /**
     * UC06 – Quản lý địa điểm sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     *
     * Mỗi kỳ hạn tối thiểu 12 tháng và không được chồng lấn kỳ hạn cũ.
     */
    @PostMapping("/api/admin/locations/{id}/service-terms")
    public ResponseEntity<ApiResponse<ServiceTermDto>> postAdminLocationsByIdServiceTerms(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody CreateServiceTermRequest request) {
        ServiceTermDto created = serviceTermService.create(currentUser, id, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Ghi nhận kỳ hạn dịch vụ thành công", created));
    }
}
