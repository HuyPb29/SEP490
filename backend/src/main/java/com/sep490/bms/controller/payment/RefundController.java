package com.sep490.bms.controller.payment;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.request.RecordRefundRequest;
import com.sep490.bms.entity.enums.RefundStatus;
import com.sep490.bms.dto.response.RefundResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.reschedule.RefundService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Cho Owner xem yêu cầu hoàn tiền và ghi nhận khoản đã hoàn tại địa điểm đang chọn.
 */
@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('OWNER')")
public class RefundController {
    private final RefundService service;
    @GetMapping("/api/owner/refunds")
    public ApiResponse<List<RefundResponse>> list(@AuthenticationPrincipal UserPrincipal u,@RequestParam(required=false) RefundStatus status) {
        return ApiResponse.success(service.list(u,status));
    }
    @GetMapping("/api/owner/refunds/{id}")
    public ApiResponse<RefundResponse> detail(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id) { return ApiResponse.success(service.detail(u,id)); }
    @PostMapping("/api/owner/refunds/{id}/record")
    public ApiResponse<RefundResponse> record(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id,@Valid @RequestBody RecordRefundRequest r) {
        RefundResponse result = service.record(u, id, r);
        return ApiResponse.success("Đã ghi nhận hoàn tiền cho đặt sân " + result.bookingCode() + ". (MSG72)", result);
    }
}
