package com.sep490.bms.controller.operation;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.operation.BookingReportResponse;
import com.sep490.bms.dto.operation.OccupancyReportResponse;
import com.sep490.bms.dto.operation.RevenueReportResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.operation.OperationService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F9 – Vận hành và báo cáo
 * Owner: Hoàng
 * UC: UC35 – Xem báo cáo vận hành và doanh thu
 * Tham số from/to (yyyy-MM-dd) mặc định từ đầu tháng đến hôm nay, tối đa 366 ngày.
 */
@RestController
@RequiredArgsConstructor
public class ReportController {

    private final OperationService operationService;

    @GetMapping("/api/owner/booking-reports")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<BookingReportResponse>> getOwnerBookingReports(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(
                operationService.getBookingReport(currentUser.getId(), from, to)));
    }

    @GetMapping("/api/owner/revenue-reports")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<RevenueReportResponse>> getOwnerRevenueReports(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(
                operationService.getRevenueReport(currentUser.getId(), from, to)));
    }

    @GetMapping("/api/owner/occupancy-reports")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<OccupancyReportResponse>> getOwnerOccupancyReports(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(
                operationService.getOccupancyReport(currentUser.getId(), from, to)));
    }
}
