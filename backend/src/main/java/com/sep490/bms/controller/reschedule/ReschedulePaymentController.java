package com.sep490.bms.controller.reschedule;

import java.util.List;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.request.ReschedulePaymentDecision;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.reschedule.RescheduleRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.reschedule.RescheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * UC21: thanh toán phần chênh lệch của yêu cầu đổi lịch.
 * Khi gộp MinhDD, giữ /payments và /staff/payments cho thanh toán booking UC18–19.
 * Phụ thu dùng /reschedule-payments và /staff/reschedule-payments để giữ nguyên
 * DTO, quyền và quy tắc đổi lịch mà không ghi đè handler của Minh.
 * Các id dưới /reschedule-payments là Payment.id, không phải RescheduleRequest.id;
 * hai endpoint hướng dẫn/gửi phụ thu vẫn nhận RescheduleRequest.id như trước.
 * Service giữ kiểm tra sở hữu/địa điểm, khóa, deadline, xác nhận và tích điểm;
 * từ chối/hết hạn chỉ nhả slot mới, giữ booking và lịch cũ đã thanh toán.
 */
@RestController
@RequiredArgsConstructor
public class ReschedulePaymentController {
    private final RescheduleService service;

    @GetMapping("/api/reschedule-requests/{id}/payment-instructions")
    @PreAuthorize("hasRole('PLAYER')")
    public ApiResponse<RescheduleService.Instructions> instructions(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        return ApiResponse.success(service.instructions(user, id));
    }

    @PostMapping("/api/reschedule-requests/{id}/payments")
    @PreAuthorize("hasRole('PLAYER')")
    public ApiResponse<RescheduleRequest> submit(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long id,
            @RequestPart(value = "proof", required = false) MultipartFile proof) {
        return ApiResponse.success(service.submit(user, id, proof));
    }

    @GetMapping("/api/reschedule-payments/{id}")
    @PreAuthorize("hasAnyRole('PLAYER', 'STAFF', 'OWNER')")
    public ApiResponse<RescheduleService.PaymentView> detail(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        return ApiResponse.success(service.payment(user, id));
    }

    @GetMapping("/api/staff/reschedule-payments")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ApiResponse<List<Payment>> list(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) PaymentStatus status) {
        return ApiResponse.success(service.staffPayments(user, status));
    }

    @GetMapping("/api/staff/reschedule-payments/{id}")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ApiResponse<RescheduleService.PaymentView> staffDetail(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        return ApiResponse.success(service.payment(user, id));
    }

    @PostMapping("/api/staff/reschedule-payments/{id}/confirm")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ApiResponse<RescheduleRequest> confirm(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long id,
            @Valid @RequestBody(required = false) ReschedulePaymentDecision request) {
        return ApiResponse.success(service.decidePayment(user, id, true, request));
    }

    @PostMapping("/api/staff/reschedule-payments/{id}/reject")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ApiResponse<RescheduleRequest> reject(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long id,
            @Valid @RequestBody ReschedulePaymentDecision request) {
        return ApiResponse.success(service.decidePayment(user, id, false, request));
    }
}
