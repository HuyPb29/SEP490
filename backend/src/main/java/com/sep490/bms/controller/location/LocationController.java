package com.sep490.bms.controller.location;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.booking.BatchOfferPublicResponse;
import com.sep490.bms.dto.location.LocationDetailResponse;
import com.sep490.bms.dto.location.LocationSummaryResponse;
import com.sep490.bms.service.booking.PackageService;
import com.sep490.bms.service.location.LocationQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Cung cấp API công khai để tìm địa điểm, xem chi tiết và tra cứu ưu đãi đặt theo lô.
 *
 * Feature: F3 – Tìm và đặt sân
 * Owner: Minh
 * UC: UC11 – Tìm địa điểm; UC12 – Xem thông tin sân công khai; UC15 – Đặt nhiều buổi
 */
@RestController
@RequiredArgsConstructor
public class LocationController {

    private final LocationQueryService locationQueryService;
    private final PackageService packageService;

    /**
     * UC11 – Tìm địa điểm. Công khai cho Guest.
     * q: từ khóa tên hoặc địa chỉ (không dấu cũng khớp). lat, lng: vị trí người dùng, gửi cả hai để xếp gần → xa.
     */
    @GetMapping("/api/locations")
    public ResponseEntity<ApiResponse<List<LocationSummaryResponse>>> getLocations(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng) {
        return ResponseEntity.ok(ApiResponse.success(locationQueryService.search(q, lat, lng)));
    }

    /** UC12 – Xem thông tin sân công khai (#1: thông tin địa điểm, giờ mở cửa). Công khai cho Guest. */
    @GetMapping("/api/locations/{id}")
    public ResponseEntity<ApiResponse<LocationDetailResponse>> getLocationsById(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(locationQueryService.detail(id)));
    }

    /**
     * UC15 – Đặt nhiều buổi (#9: chương trình ưu đãi đặt theo lô đang diễn ra). Công khai cho Guest.
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     */
    @GetMapping("/api/locations/{id}/batch-offers")
    public ResponseEntity<ApiResponse<List<BatchOfferPublicResponse>>> getLocationsByIdBatchOffers(
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(packageService.listActiveBatchOffers(id)));
    }
}
