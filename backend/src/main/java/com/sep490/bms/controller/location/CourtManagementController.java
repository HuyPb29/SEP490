package com.sep490.bms.controller.location;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.CourtDto;
import com.sep490.bms.dto.location.CreateCourtRequest;
import com.sep490.bms.dto.location.UpdateCourtRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.CourtManagementService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC07 – Quản lý địa điểm và sân
 */
@RestController
@RequiredArgsConstructor
public class CourtManagementController {

    private final CourtManagementService courtManagementService;

    /**
     * UC07 – Quản lý địa điểm và sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/owner/locations/{id}/courts")
    public ResponseEntity<ApiResponse<List<CourtDto>>> getOwnerLocationsByIdCourts(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(courtManagementService.listOwned(currentUser, id)));
    }

    /**
     * UC07 – Quản lý địa điểm và sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/owner/locations/{id}/courts")
    public ResponseEntity<ApiResponse<CourtDto>> postOwnerLocationsByIdCourts(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody CreateCourtRequest request) {
        CourtDto created = courtManagementService.create(currentUser, id, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Thêm sân thành công", created));
    }

    /**
     * UC07 – Quản lý địa điểm và sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PatchMapping("/api/owner/courts/{id}")
    public ResponseEntity<ApiResponse<CourtDto>> patchOwnerCourtsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateCourtRequest request) {
        CourtDto updated = courtManagementService.update(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật sân thành công", updated));
    }
}
