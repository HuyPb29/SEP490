package com.sep490.bms.controller.location;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.OpeningHourDto;
import com.sep490.bms.dto.location.UpdateOpeningHoursRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.OpeningHourService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC08 – Quản lý giờ mở cửa và slot
 */
@RestController
@RequiredArgsConstructor
public class OpeningHourController {

    private final OpeningHourService openingHourService;

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     *
     * Luôn trả đủ 7 ngày (1 = Thứ 2 ... 7 = Chủ nhật);
     * ngày chưa thiết lập có configured = false.
     */
    @GetMapping("/api/owner/locations/{id}/opening-hours")
    public ResponseEntity<ApiResponse<List<OpeningHourDto>>> getOwnerLocationsByIdOpeningHours(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(openingHourService.list(currentUser, id)));
    }

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     *
     * Thay thế toàn phần: ngày không gửi lên sẽ bị xoá cấu hình.
     */
    @PutMapping("/api/owner/locations/{id}/opening-hours")
    public ResponseEntity<ApiResponse<List<OpeningHourDto>>> putOwnerLocationsByIdOpeningHours(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateOpeningHoursRequest request) {
        List<OpeningHourDto> week = openingHourService.replace(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật giờ mở cửa thành công", week));
    }
}
