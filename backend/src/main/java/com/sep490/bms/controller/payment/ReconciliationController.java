package com.sep490.bms.controller.payment;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.payment.ReconciliationSummaryResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.payment.ReconciliationService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F4 – Thanh toán
 * Owner: Minh
 * UC: UC20 – Đối soát doanh thu cuối ngày
 */
@RestController
@RequiredArgsConstructor
public class ReconciliationController {

    private final ReconciliationService reconciliationService;

    /**
     * UC20 – Đối soát doanh thu cuối ngày (#1: tổng giao dịch đã xác nhận trong ngày)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Không gửi date thì lấy hôm nay (yyyy-MM-dd).
     */
    @GetMapping("/api/staff/reconciliations")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse<ReconciliationSummaryResponse>> getStaffReconciliations(
            @RequestParam(value = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(reconciliationService.getDaySummary(currentUser, date)));
    }

    /**
     * UC20 – Đối soát doanh thu cuối ngày
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/reconciliations/{id}")
    public ResponseEntity<Void> getStaffReconciliationsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC20 – Đối soát doanh thu cuối ngày
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/reconciliations")
    public ResponseEntity<Void> postStaffReconciliations() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC20 – Đối soát doanh thu cuối ngày (#5: Owner xem kết quả đối soát)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/reconciliations")
    public ResponseEntity<Void> getOwnerReconciliations() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
