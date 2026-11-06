package com.sep490.bms.controller.booking;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;
import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.booking.BookingResponse;
import com.sep490.bms.dto.booking.BookingSummaryResponse;
import com.sep490.bms.dto.request.BookingRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.BookingService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F3 – Tìm và đặt sân
 * Owner: Minh
 * UC: UC14 – Đặt sân lẻ; UC16 – Đặt sân tại quầy; UC17 – Xem lịch sử booking
 */
@RestController
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;
    private final com.sep490.bms.service.booking.BookingManagementService management;

    /**
     * UC14 – Đặt sân lẻ (#1–5: màn tóm tắt, áp voucher và điểm; không lưu gì)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     */
    @PostMapping("/api/bookings/summary")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<BookingSummaryResponse>> postBookingsSummary(
            @Valid @RequestBody BookingRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(bookingService.previewSummary(currentUser, request)));
    }

    /**
     * UC14 – Đặt sân lẻ (#6–8: bấm Xác nhận, tạo booking Đang giữ chỗ, giữ chỗ 5 phút)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     */
    @PostMapping("/api/bookings")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<BookingResponse>> postBookings(
            @Valid @RequestBody BookingRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(bookingService.createSingleBooking(currentUser, request)));
    }

    @GetMapping("/api/bookings/{id}")
    @PreAuthorize("hasAnyRole('PLAYER','STAFF','OWNER')")
    public ApiResponse<com.sep490.bms.entity.booking.Booking> detail(@PathVariable Long id,@AuthenticationPrincipal UserPrincipal u) {
        return ApiResponse.success(management.detail(u,id));
    }
    @PostMapping("/api/staff/bookings")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse<com.sep490.bms.entity.booking.Booking>> createWalkIn(@AuthenticationPrincipal UserPrincipal u,
            @Valid @RequestBody com.sep490.bms.dto.request.WalkInBookingRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(management.createWalkIn(u,r)));
    }
    @PostMapping("/api/staff/bookings/{id}/confirm")
    @PreAuthorize("hasRole('STAFF')")
    public ApiResponse<com.sep490.bms.entity.booking.Booking> confirmWalkIn(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id,
            @Valid @RequestBody(required=false) com.sep490.bms.dto.payment.ConfirmPaymentRequest r) {
        return ApiResponse.success(management.confirmWalkIn(u,id,r));
    }
    @GetMapping("/api/me/bookings")
    @PreAuthorize("hasRole('PLAYER')")
    public ApiResponse<com.sep490.bms.common.PageResponse<com.sep490.bms.entity.booking.Booking>> mine(@AuthenticationPrincipal UserPrincipal u,
            @org.springframework.web.bind.annotation.RequestParam(required=false) com.sep490.bms.entity.enums.BookingStatus status,
            @org.springframework.web.bind.annotation.RequestParam(required=false) java.time.LocalDate from,
            @org.springframework.web.bind.annotation.RequestParam(required=false) java.time.LocalDate to,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue="0") int page,@org.springframework.web.bind.annotation.RequestParam(defaultValue="20") int size) {
        return ApiResponse.success(management.list(u,false,status,from,to,page,size));
    }
    @GetMapping("/api/staff/bookings")
    @PreAuthorize("hasAnyRole('STAFF','OWNER')")
    public ApiResponse<com.sep490.bms.common.PageResponse<com.sep490.bms.entity.booking.Booking>> staff(@AuthenticationPrincipal UserPrincipal u,
            @org.springframework.web.bind.annotation.RequestParam(required=false) com.sep490.bms.entity.enums.BookingStatus status,
            @org.springframework.web.bind.annotation.RequestParam(required=false) java.time.LocalDate from,
            @org.springframework.web.bind.annotation.RequestParam(required=false) java.time.LocalDate to,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue="0") int page,@org.springframework.web.bind.annotation.RequestParam(defaultValue="20") int size) {
        return ApiResponse.success(management.list(u,true,status,from,to,page,size));
    }
}