package com.sep490.bms.controller.booking;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.booking.BookingOrderRequest;
import com.sep490.bms.dto.booking.PackageDetailResponse;
import com.sep490.bms.dto.booking.PackagePreviewResponse;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.PackageService;
import com.sep490.bms.service.reschedule.CancellationService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Đơn đặt lẻ (UC14, BR64, D164): nhiều dải slot trong một ngày, thanh toán một lần. Đơn lưu như gói loại DAY nên
 * thanh toán, xác nhận và lịch sử dùng chung API của gói (/api/booking-packages/{id}/...).
 * Feature: F3 – Tìm và đặt sân. Owner: Minh
 */
@RestController
@RequiredArgsConstructor
public class BookingOrderController {

    private final PackageService packageService;
    private final CancellationService cancellationService;

    /** UC14 #2–5: màn tóm tắt của đơn: giá từng dải, dải bị trùng, voucher và điểm. Không giữ chỗ. */
    @PostMapping("/api/booking-orders/preview")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PackagePreviewResponse>> postBookingOrdersPreview(
            @Valid @RequestBody BookingOrderRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(packageService.previewOrder(currentUser, request)));
    }

    /** UC14 #6–8: bấm Xác nhận: tạo đơn Đang giữ chỗ 10 phút, mỗi dải một booking. */
    @PostMapping("/api/booking-orders")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PackageDetailResponse>> postBookingOrders(
            @Valid @RequestBody BookingOrderRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                "Đã tạo đơn, giữ chỗ trong 10 phút.", packageService.createOrder(currentUser, request)));
    }

    /** UC22 #1, BR07, BR64: hủy cả đơn (mọi booking chưa chơi), không hoàn tiền. */
    @PostMapping("/api/booking-orders/{id}/cancel")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<Integer>> postBookingOrdersByIdCancel(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<Booking> cancelled = cancellationService.cancelOrder(currentUser, id);
        return ResponseEntity.ok(ApiResponse.success(
                "Đã hủy " + cancelled.size() + " booking của đơn. Tiền đã trả không được hoàn.", cancelled.size()));
    }
}
