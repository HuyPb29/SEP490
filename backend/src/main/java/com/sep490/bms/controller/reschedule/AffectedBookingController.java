package com.sep490.bms.controller.reschedule;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.request.AffectedChoiceRequest;
import com.sep490.bms.entity.reschedule.AffectedBooking;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.reschedule.CancellationService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Cho Player xem booking bị ảnh hưởng và chọn đổi slot, hoàn tiền hoặc điểm bồi hoàn.
 */
@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLAYER')")
public class AffectedBookingController {
    private final CancellationService service;
    @GetMapping("/api/me/affected-bookings")
    public ApiResponse<List<AffectedBooking>> list(@AuthenticationPrincipal UserPrincipal u) { return ApiResponse.success(service.list(u)); }
    @GetMapping("/api/affected-bookings/{id}")
    public ApiResponse<AffectedBooking> detail(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id) { return ApiResponse.success(service.detail(u,id)); }
    @PostMapping("/api/affected-bookings/{id}/submit-choice")
    public ApiResponse<AffectedBooking> choose(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id,@Valid @RequestBody AffectedChoiceRequest r) {
        return ApiResponse.success(service.choose(u,id,r));
    }
}
