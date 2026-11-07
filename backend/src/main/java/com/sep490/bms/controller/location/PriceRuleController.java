package com.sep490.bms.controller.location;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.CreatePriceRuleRequest;
import com.sep490.bms.dto.location.PriceRuleDto;
import com.sep490.bms.dto.location.UpdatePriceRuleRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.PriceRuleService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
 */
@RestController
@RequiredArgsConstructor
public class PriceRuleController {

    private final PriceRuleService priceRuleService;

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/owner/courts/{id}/price-rules")
    public ResponseEntity<ApiResponse<List<PriceRuleDto>>> getOwnerCourtsByIdPriceRules(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(priceRuleService.list(currentUser, id)));
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/owner/courts/{id}/price-rules")
    public ResponseEntity<ApiResponse<PriceRuleDto>> postOwnerCourtsByIdPriceRules(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody CreatePriceRuleRequest request) {
        PriceRuleDto created = priceRuleService.create(currentUser, id, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Thêm quy tắc giá thành công", created));
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PatchMapping("/api/owner/price-rules/{id}")
    public ResponseEntity<ApiResponse<PriceRuleDto>> patchOwnerPriceRulesById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdatePriceRuleRequest request) {
        PriceRuleDto updated = priceRuleService.update(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật quy tắc giá thành công", updated));
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @DeleteMapping("/api/owner/price-rules/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteOwnerPriceRulesById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        priceRuleService.delete(currentUser, id);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá quy tắc giá"));
    }
}
