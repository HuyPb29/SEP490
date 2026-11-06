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
import org.springframework.web.bind.annotation.RequestParam;
import jakarta.validation.Valid;
import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.booking.BookingDetailResponse;
import com.sep490.bms.dto.booking.BookingListItem;
import com.sep490.bms.dto.booking.BookingResponse;
import com.sep490.bms.dto.booking.BookingSummaryResponse;
import com.sep490.bms.dto.booking.WalkInBookingItem;
import com.sep490.bms.dto.booking.WalkInBookingRequest;
import com.sep490.bms.dto.request.BookingRequest;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.BookingQueryService;
import com.sep490.bms.service.booking.BookingService;
import com.sep490.bms.service.booking.WalkInBookingService;

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
    private final BookingQueryService bookingQueryService;
    private final WalkInBookingService walkInBookingService;

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

    /**
     * UC14 – Đặt sân lẻ
     * UC17 – Xem lịch sử booking (#3–5: chi tiết booking, đếm ngược giữ chỗ, paymentId cho nút Gửi lại chứng từ)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     */
    @GetMapping("/api/bookings/{id}")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<BookingDetailResponse>> getBookingsById(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(bookingQueryService.getMyBooking(currentUser, id)));
    }

    /**
     * UC16 – Đặt sân tại quầy (#1–2: Staff nhập tên, số điện thoại khách, chọn slot; giữ chỗ 5 phút)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Địa điểm lấy từ tài khoản Staff, không cần header X-Location-Id.
     */
    @PostMapping("/api/staff/bookings")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse<WalkInBookingItem>> postStaffBookings(
            @Valid @RequestBody WalkInBookingRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                "Đã tạo booking, giữ chỗ trong 5 phút. Xác nhận khi đã nhận đủ tiền.",
                walkInBookingService.create(currentUser, request)));
    }

    /**
     * UC16 – Đặt sân tại quầy
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/bookings")
    public ResponseEntity<Void> getStaffBookings() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC16 – Đặt sân tại quầy (#3: Staff thấy tiền đã về thì xác nhận; không có ảnh chứng từ)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Tạo payment Đã xác nhận kèm biên nhận để đối soát cuối ngày (UC20) cộng được khoản này.
     */
    @PostMapping("/api/staff/bookings/{id}/confirm")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse<WalkInBookingItem>> postStaffBookingsByIdConfirm(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        WalkInBookingItem result = walkInBookingService.confirm(currentUser, id);
        return ResponseEntity.ok(ApiResponse.success(
                "Đã xác nhận thanh toán booking " + result.getBookingCode() + ".", result));
    }

    /**
     * UC17 – Xem lịch sử booking (#1–2: booking lẻ của tôi, booking chờ thanh toán xếp đầu, lọc theo trạng thái)
     * Feature: F3 – Tìm và đặt sân
     * Owner: Minh
     * Gói đặt nhiều buổi xem ở GET /api/me/booking-packages. Không gửi status thì lấy mọi trạng thái.
     */
    @GetMapping("/api/me/bookings")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PageResponse<BookingListItem>>> getMeBookings(
            @RequestParam(value = "status", required = false) BookingStatus status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(bookingQueryService.listMyBookings(currentUser, status, page, size)));
    }
}
