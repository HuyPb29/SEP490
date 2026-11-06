package com.sep490.bms.controller.booking;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.request.PackageBookingRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.PackageBookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @PreAuthorize("hasRole('PLAYER')")
public class BookingPackageController {
    private final PackageBookingService service;
    @PostMapping("/api/booking-packages/preview")
    public ApiResponse<PackageBookingService.Preview> preview(@AuthenticationPrincipal UserPrincipal u,@Valid @RequestBody PackageBookingRequest r) {
        return ApiResponse.success(service.preview(u,r));
    }
    @PostMapping("/api/booking-packages")
    public ResponseEntity<ApiResponse<PackageBookingService.View>> create(@AuthenticationPrincipal UserPrincipal u,@Valid @RequestBody PackageBookingRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(service.create(u,r)));
    }
    @GetMapping("/api/booking-packages/{id}")
    public ApiResponse<PackageBookingService.View> detail(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id) {
        return ApiResponse.success(service.detail(u,id));
    }
    @GetMapping("/api/me/booking-packages")
    public ApiResponse<java.util.List<com.sep490.bms.entity.booking.BookingPackage>> mine(@AuthenticationPrincipal UserPrincipal u) {
        return ApiResponse.success(service.mine(u));
    }
}