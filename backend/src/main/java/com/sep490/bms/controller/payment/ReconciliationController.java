package com.sep490.bms.controller.payment;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.payment.ReconciliationRequest;
import com.sep490.bms.dto.payment.ReconciliationResponse;
import com.sep490.bms.dto.payment.ReconciliationSummaryResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.payment.ReconciliationService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Feature: F4 – Thanh toán
 * Owner: Minh
 * UC: UC20 – Đối soát doanh thu cuối ngày
 */
@RestController
@RequiredArgsConstructor
public class ReconciliationController {

    private static final DateTimeFormatter DAY_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ReconciliationService reconciliationService;

    /**
     * UC20 – Đối soát doanh thu cuối ngày (#1: tổng giao dịch đã xác nhận trong ngày)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Không gửi date thì lấy hôm nay (yyyy-MM-dd). Ngày đã đối soát thì trả kèm kết quả đã lưu.
     */
    @GetMapping("/api/staff/reconciliations")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse<ReconciliationSummaryResponse>> getStaffReconciliations(
            @RequestParam(value = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(reconciliationService.getDaySummary(currentUser, date)));
    }

    /**
     * UC20 – Đối soát doanh thu cuối ngày (#4: xem lại một kết quả đã lưu)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Staff xem địa điểm của mình; Owner gửi header X-Location-Id.
     */
    @GetMapping("/api/staff/reconciliations/{id}")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<ApiResponse<ReconciliationResponse>> getStaffReconciliationsById(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(reconciliationService.getById(currentUser, id)));
    }

    /**
     * UC20 – Đối soát doanh thu cuối ngày (#2–#4: nhập số thực nhận, lý do khi lệch, lưu; mỗi ngày một lần)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @PostMapping("/api/staff/reconciliations")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse<ReconciliationResponse>> postStaffReconciliations(
            @Valid @RequestBody ReconciliationRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        ReconciliationResponse result = reconciliationService.submit(currentUser, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                "Đã lưu kết quả đối soát ngày " + DAY_FORMAT.format(result.getDate()) + ".", result));
    }

    /**
     * UC20 – Đối soát doanh thu cuối ngày (#5: Owner xem kết quả đối soát)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Địa điểm theo header X-Location-Id. from, to (yyyy-MM-dd) không bắt buộc; ngày mới nhất lên đầu.
     */
    @GetMapping("/api/owner/reconciliations")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PageResponse<ReconciliationResponse>>> getOwnerReconciliations(
            @RequestParam(value = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(value = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(
                reconciliationService.listForOwner(currentUser, from, to, page, size)));
    }
}
