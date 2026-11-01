package com.sep490.bms.controller.location;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.LocationDetailResponse;
import com.sep490.bms.dto.location.LocationSummaryResponse;
import com.sep490.bms.service.location.LocationQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F3 – Tìm và đặt sân
 * Owner: Minh
 * UC: UC11 – Tìm địa điểm; UC12 – Xem thông tin sân công khai; UC15 – Đặt nhiều buổi
 */
@RestController
@RequiredArgsConstructor
public class LocationController {

    private final LocationQueryService locationQueryService;

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
     * UC15 – Đặt nhiều buổi (#9: Player xem chương trình ưu đãi đặt theo lô đang diễn ra)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/locations/{id}/batch-offers")
    public ResponseEntity<Void> getLocationsByIdBatchOffers(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
