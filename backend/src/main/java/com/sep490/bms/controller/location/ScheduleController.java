package com.sep490.bms.controller.location;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.booking.ScheduleResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.ScheduleService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F3 – Tìm và đặt sân
 * Owner: Minh
 * UC: UC13 – Xem lịch sân
 */
@RestController
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    /**
     * UC13 – Xem lịch sân (lịch theo ngày của cả địa điểm: mỗi hàng một sân, mỗi cột một slot).
     * Công khai cho Guest. date dạng yyyy-MM-dd, không gửi thì lấy hôm nay.
     */
    @GetMapping("/api/locations/{id}/schedules")
    public ResponseEntity<ApiResponse<ScheduleResponse>> getLocationsByIdSchedules(
            @PathVariable("id") Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(scheduleService.schedule(id, date, currentUser)));
    }
}
