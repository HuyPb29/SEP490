package com.sep490.bms.controller.location;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.SlotSettingDto;
import com.sep490.bms.dto.location.UpdateSlotSettingRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.SlotSettingService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC08 – Quản lý giờ mở cửa và slot
 */
@RestController
@RequiredArgsConstructor
public class SlotSettingController {

    private final SlotSettingService slotSettingService;

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/owner/courts/{id}/slot-settings")
    public ResponseEntity<ApiResponse<SlotSettingDto>> getOwnerCourtsByIdSlotSettings(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(slotSettingService.get(currentUser, id)));
    }

    /**
     * UC08 – Quản lý giờ mở cửa và slot
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PutMapping("/api/owner/courts/{id}/slot-settings")
    public ResponseEntity<ApiResponse<SlotSettingDto>> putOwnerCourtsByIdSlotSettings(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateSlotSettingRequest request) {
        SlotSettingDto updated = slotSettingService.update(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật cấu hình slot thành công", updated));
    }
}
