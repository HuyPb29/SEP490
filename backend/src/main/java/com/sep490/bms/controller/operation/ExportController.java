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
import com.sep490.bms.service.operation.VenueExportService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F9 – Vận hành và báo cáo
 * Owner: Hoàng
 * UC: UC36 – Tải dữ liệu địa điểm (một file Excel ba sheet, FR122)
 * Tham số from/to (yyyy-MM-dd) là kỳ của sheet Booking đã qua và Thu chi; mặc định từ đầu tháng đến hôm nay.
 * Owner của địa điểm bị khóa vẫn gọi được trong P29 ngày (FR123).
 */
@RestController
@RequiredArgsConstructor
public class ExportController {

    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final VenueExportService venueExportService;

    @GetMapping("/api/owner/exports")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<byte[]> getOwnerExports(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        byte[] body = venueExportService.exportVenueData(currentUser, from, to);
        return ResponseEntity.ok()
                .contentType(XLSX)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("venue-data-" + LocalDate.now() + ".xlsx").build().toString())
                .body(body);
    }
}
