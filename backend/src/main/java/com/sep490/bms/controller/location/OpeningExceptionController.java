package com.sep490.bms.controller.location;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.CreateOpeningExceptionRequest;
import com.sep490.bms.dto.location.OpeningExceptionDto;
import com.sep490.bms.dto.location.UpdateOpeningExceptionRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.OpeningExceptionService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC08 – Quản lý giờ mở cửa và slot
 */
@RestController
@RequiredArgsConstructor
public class OpeningExceptionController {

    private final OpeningExceptionService openingExceptionService;

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     *
     * Lọc tuỳ chọn: ?from=2026-11-01&to=2026-11-30 (định dạng yyyy-MM-dd).
     */
    @GetMapping("/api/owner/locations/{id}/opening-exceptions")
    public ResponseEntity<ApiResponse<List<OpeningExceptionDto>>> getOwnerLocationsByIdOpeningExceptions(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @RequestParam(value = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(value = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(openingExceptionService.list(currentUser, id, from, to)));
    }

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/owner/locations/{id}/opening-exceptions")
    public ResponseEntity<ApiResponse<OpeningExceptionDto>> postOwnerLocationsByIdOpeningExceptions(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody CreateOpeningExceptionRequest request) {
        OpeningExceptionDto created = openingExceptionService.create(currentUser, id, request);
        return ResponseEntity.status(201).body(ApiResponse.success("Thêm ngày ngoại lệ thành công", created));
    }

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PatchMapping("/api/owner/opening-exceptions/{id}")
    public ResponseEntity<ApiResponse<OpeningExceptionDto>> patchOwnerOpeningExceptionsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateOpeningExceptionRequest request) {
        OpeningExceptionDto updated = openingExceptionService.update(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật ngày ngoại lệ thành công", updated));
    }

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @DeleteMapping("/api/owner/opening-exceptions/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteOwnerOpeningExceptionsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        openingExceptionService.delete(currentUser, id);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá ngày ngoại lệ"));
    }
}
