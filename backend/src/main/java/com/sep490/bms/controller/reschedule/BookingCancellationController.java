package com.sep490.bms.controller.reschedule;

import java.time.LocalDate;
import java.util.List;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.request.OwnerCancellationRequest;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.reschedule.CancellationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Cung cấp API hủy booking cho Player và xử lý hủy tại địa điểm cho Owner.
 */
@RestController
@RequiredArgsConstructor
public class BookingCancellationController {
    private final CancellationService service;
    @PreAuthorize("hasRole('PLAYER')")
    @PostMapping("/api/bookings/{id}/cancel")
    public ApiResponse<Booking> cancel(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id) {
        return ApiResponse.success(service.cancel(u,id));
    }
    @PreAuthorize("hasRole('OWNER')")
    @GetMapping("/api/owner/bookings/cancellable")
    public ApiResponse<List<CancellationService.CancellableBooking>> ownerBookings(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate playDate) {
        return ApiResponse.success(service.ownerBookings(user, playDate));
    }

    @PreAuthorize("hasRole('OWNER')")
    @PostMapping({"/api/owner/bookings/{id}/cancel","/api/staff/bookings/{id}/cancel"})
    public ApiResponse<Object> ownerCancel(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id,@Valid @RequestBody OwnerCancellationRequest r) {
        return ApiResponse.success(service.ownerCancel(u,id,r));
    }
}
