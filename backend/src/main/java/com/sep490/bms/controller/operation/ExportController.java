package com.sep490.bms.controller.operation;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.operation.OperationService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F9 – Vận hành và báo cáo
 * Owner: Hoàng
 * UC: UC36 – Tải dữ liệu quản lý địa điểm (CSV UTF-8)
 */
@RestController
@RequiredArgsConstructor
public class ExportController {

    private static final MediaType CSV = new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8);

    private final OperationService operationService;

    @GetMapping("/api/owner/booking-exports")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<byte[]> getOwnerBookingExports(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return csv("bookings", operationService.exportBookings(currentUser.getId(), from, to));
    }

    @GetMapping("/api/owner/revenue-exports")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<byte[]> getOwnerRevenueExports(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return csv("revenue", operationService.exportRevenue(currentUser.getId(), from, to));
    }

    private ResponseEntity<byte[]> csv(String name, byte[] body) {
        return ResponseEntity.ok()
                .contentType(CSV)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(name + "-" + LocalDate.now() + ".csv").build().toString())
                .body(body);
    }
}
