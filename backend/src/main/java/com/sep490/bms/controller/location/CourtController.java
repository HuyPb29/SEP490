package com.sep490.bms.controller.location;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.CourtResponse;
import com.sep490.bms.service.location.CourtQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F3 – Tìm và đặt sân
 * Owner: Minh
 * UC: UC12 – Xem thông tin sân công khai
 */
@RestController
@RequiredArgsConstructor
public class CourtController {

    private final CourtQueryService courtQueryService;

    /** UC12 – Xem thông tin sân công khai (#1: danh sách sân). Công khai cho Guest. */
    @GetMapping("/api/locations/{id}/courts")
    public ResponseEntity<ApiResponse<List<CourtResponse>>> getLocationsByIdCourts(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(courtQueryService.listActive(id)));
    }

    /** UC12 – Xem thông tin sân công khai (#2: chi tiết sân kèm bảng giá). Công khai cho Guest. */
    @GetMapping("/api/courts/{id}")
    public ResponseEntity<ApiResponse<CourtResponse>> getCourtsById(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(courtQueryService.detail(id)));
    }
}
