package com.sep490.bms.controller.payment;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.request.RecordRefundRequest;
import com.sep490.bms.entity.enums.RefundStatus;
import com.sep490.bms.entity.reschedule.RefundRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.reschedule.RefundService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('OWNER')")
public class RefundController {
    private final RefundService service;
    @GetMapping("/api/owner/refunds")
    public ApiResponse<List<RefundRequest>> list(@AuthenticationPrincipal UserPrincipal u,@RequestParam(required=false) RefundStatus status) {
        return ApiResponse.success(service.list(u,status));
    }
    @GetMapping("/api/owner/refunds/{id}")
    public ApiResponse<RefundRequest> detail(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id) { return ApiResponse.success(service.detail(u,id)); }
    @PostMapping("/api/owner/refunds/{id}/record")
    public ApiResponse<RefundRequest> record(@AuthenticationPrincipal UserPrincipal u,@PathVariable Long id,@Valid @RequestBody RecordRefundRequest r) {
        return ApiResponse.success(service.record(u,id,r));
    }
}
