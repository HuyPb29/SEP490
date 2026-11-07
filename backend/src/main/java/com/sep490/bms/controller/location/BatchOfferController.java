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
import com.sep490.bms.dto.location.BatchOfferDto;
import com.sep490.bms.dto.location.CreateBatchOfferRequest;
import com.sep490.bms.dto.location.UpdateBatchOfferRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.BatchOfferService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
 *
 * Hai endpoint không có {id} địa điểm nên địa điểm được chọn qua header X-Location-Id.
 */
@RestController
@RequiredArgsConstructor
public class BatchOfferController {

    private final BatchOfferService batchOfferService;

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     *
     * Bắt buộc gửi header X-Location-Id.
     */
    @GetMapping("/api/owner/batch-offers")
    public ResponseEntity<ApiResponse<List<BatchOfferDto>>> getOwnerBatchOffers(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(batchOfferService.list(currentUser)));
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     *
     * Bắt buộc gửi header X-Location-Id.
     */
    @PostMapping("/api/owner/batch-offers")
    public ResponseEntity<ApiResponse<BatchOfferDto>> postOwnerBatchOffers(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody CreateBatchOfferRequest request) {
        BatchOfferDto created = batchOfferService.create(currentUser, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Thêm ưu đãi đặt theo lô thành công", created));
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PatchMapping("/api/owner/batch-offers/{id}")
    public ResponseEntity<ApiResponse<BatchOfferDto>> patchOwnerBatchOffersById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateBatchOfferRequest request) {
        BatchOfferDto updated = batchOfferService.update(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật ưu đãi thành công", updated));
    }

    /**
     * UC09 – Quản lý bảng giá và ưu đãi đặt theo lô
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @DeleteMapping("/api/owner/batch-offers/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteOwnerBatchOffersById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        batchOfferService.delete(currentUser, id);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá ưu đãi"));
    }
}
