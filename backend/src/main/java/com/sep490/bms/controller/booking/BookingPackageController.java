package com.sep490.bms.controller.booking;

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
import com.sep490.bms.dto.booking.PackageDetailResponse;
import com.sep490.bms.dto.booking.PackageListItem;
import com.sep490.bms.dto.booking.PackagePreviewResponse;
import com.sep490.bms.dto.booking.PackageRequest;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.BookingQueryService;
import com.sep490.bms.service.booking.PackageService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Feature: F3 – Tìm và đặt sân
 * Owner: Minh
 * UC: UC15 – Đặt nhiều buổi; UC17 – Xem lịch sử booking
 */
@RestController
@RequiredArgsConstructor
public class BookingPackageController {

    private final BookingQueryService bookingQueryService;
    private final PackageService packageService;

    /**
     * UC15 – Đặt nhiều buổi (#1–2, #4: sinh các buổi theo mẫu và hiện lịch toàn kỳ; không lưu gì, không giữ chỗ)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     */
    @PostMapping("/api/booking-packages/preview")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PackagePreviewResponse>> postBookingPackagesPreview(
            @Valid @RequestBody PackageRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(packageService.preview(currentUser, request)));
    }

    /**
     * UC15 – Đặt nhiều buổi (#8, #11: tạo gói và các buổi con, giữ chỗ 15 phút)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/booking-packages")
    public ResponseEntity<Void> postBookingPackages() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC15 – Đặt nhiều buổi
     * UC17 – Xem lịch sử booking (#3–5: chi tiết gói, thanh toán của cả gói, danh sách buổi)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     */
    @GetMapping("/api/booking-packages/{id}")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PackageDetailResponse>> getBookingPackagesById(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(bookingQueryService.getMyPackage(currentUser, id)));
    }

    /**
     * UC17 – Xem lịch sử booking (#1–2: gói đặt nhiều buổi của tôi, gói chờ thanh toán xếp đầu, lọc theo trạng thái)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Không gửi status thì lấy mọi trạng thái.
     */
    @GetMapping("/api/me/booking-packages")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PageResponse<PackageListItem>>> getMeBookingPackages(
            @RequestParam(value = "status", required = false) BookingStatus status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(bookingQueryService.listMyPackages(currentUser, status, page, size)));
    }
}
