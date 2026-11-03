package com.sep490.bms.controller.reschedule;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.request.ReschedulePreviewRequest;
import com.sep490.bms.entity.reschedule.RescheduleRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.reschedule.RescheduleService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLAYER')")
public class RescheduleRequestController {
    private final RescheduleService service;
    @PostMapping("/api/bookings/{id}/reschedule-requests/preview")
    public ApiResponse<RescheduleService.Quote> preview(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id,@Valid @RequestBody ReschedulePreviewRequest r) {
        return ApiResponse.success(service.preview(u,id,r));
    }
    @PostMapping("/api/bookings/{id}/reschedule-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<RescheduleRequest> create(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id,@Valid @RequestBody ReschedulePreviewRequest r) {
        return ApiResponse.success(service.create(u,id,r));
    }
    @GetMapping("/api/bookings/{id}/reschedule-requests")
    public ApiResponse<List<RescheduleRequest>> list(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id) {
        return ApiResponse.success(service.requests(u,id));
    }
    @GetMapping("/api/reschedule-requests/{id}")
    public ApiResponse<RescheduleRequest> detail(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id) {
        return ApiResponse.success(service.detail(u,id));
    }
}
