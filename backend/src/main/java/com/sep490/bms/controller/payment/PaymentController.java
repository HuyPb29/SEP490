package com.sep490.bms.controller.payment;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.multipart.MultipartFile;
import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.request.ReschedulePaymentDecision;
import com.sep490.bms.entity.reschedule.RescheduleRequest;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.enums.PaymentStatus;
import java.util.List;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.reschedule.RescheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Feature: F4 – Thanh toán
 * Owner: Minh
 * UC: UC18 – Thanh toán booking; UC19 – Xác nhận thanh toán
 *
 * Payment chỉ được tạo khi Player gửi chứng từ (bảng payment mặc định AWAITING_CONFIRMATION,
 * không có trạng thái "chờ gửi"), nên bước xem hướng dẫn và gửi chứng từ đi theo id booking/gói.
 */
@RestController
@RequiredArgsConstructor
public class PaymentController {
    private final RescheduleService reschedules;

    /**
     * UC18 – Thanh toán booking (#1: số tiền, tài khoản, QR, thời gian giữ chỗ còn lại)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/bookings/{id}/payment-instructions")
    public ResponseEntity<Void> getBookingsByIdPaymentInstructions(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC18 – Thanh toán booking (#2, #3: multipart ảnh chứng từ; tạo payment + payment_proof)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @PostMapping("/api/bookings/{id}/payments")
    public ResponseEntity<Void> postBookingsByIdPayments(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC18 – Thanh toán booking (gói đặt nhiều buổi, UC15 #7: thanh toán toàn bộ một lần)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/booking-packages/{id}/payment-instructions")
    public ResponseEntity<Void> getBookingPackagesByIdPaymentInstructions(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC18 – Thanh toán booking (gói đặt nhiều buổi; multipart ảnh chứng từ)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @PostMapping("/api/booking-packages/{id}/payments")
    public ResponseEntity<Void> postBookingPackagesByIdPayments(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC18 – Thanh toán booking (#5: trạng thái thanh toán, biên nhận)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/payments/{id}")
    public ApiResponse<RescheduleService.PaymentView> getPaymentsById(@AuthenticationPrincipal UserPrincipal user,@PathVariable("id") Long id) {
        return ApiResponse.success(reschedules.payment(user,id));
    }

    /**
     * UC18 – Thanh toán booking (#4: gửi lại chứng từ khi được yêu cầu bổ sung)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @PostMapping("/api/payments/{id}/resubmit")
    public ResponseEntity<Void> postPaymentsByIdResubmit(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC19 – Xác nhận thanh toán
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/staff/payments")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ApiResponse<List<Payment>> getStaffPayments(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false) PaymentStatus status) {
        return ApiResponse.success(reschedules.staffPayments(user,status));
    }

    /**
     * UC19 – Xác nhận thanh toán
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/staff/payments/{id}")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ApiResponse<RescheduleService.PaymentView> getStaffPaymentsById(@AuthenticationPrincipal UserPrincipal user,@PathVariable("id") Long id) {
        return ApiResponse.success(reschedules.payment(user,id));
    }

    /**
     * UC19 – Xác nhận thanh toán (#3, #6, #7: nhập số tiền thực nhận khi chuyển thừa)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @PostMapping("/api/staff/payments/{id}/confirm")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ApiResponse<RescheduleRequest> postStaffPaymentsByIdConfirm(@AuthenticationPrincipal UserPrincipal user,
            @PathVariable("id") Long id, @Valid @RequestBody(required=false) ReschedulePaymentDecision request) {
        return ApiResponse.success(reschedules.decidePayment(user,id,true,request));
    }

    /**
     * UC19 – Xác nhận thanh toán (#5)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @PostMapping("/api/staff/payments/{id}/reject")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ApiResponse<RescheduleRequest> postStaffPaymentsByIdReject(@AuthenticationPrincipal UserPrincipal user,
            @PathVariable("id") Long id, @Valid @RequestBody ReschedulePaymentDecision request) {
        return ApiResponse.success(reschedules.decidePayment(user,id,false,request));
    }

    /**
     * UC19 – Xác nhận thanh toán (#4)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @PostMapping("/api/staff/payments/{id}/request-resubmission")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<Void> postStaffPaymentsByIdRequestResubmission(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** UC21: bank instructions and proof submission for the positive difference only. */
    @GetMapping("/api/reschedule-requests/{id}/payment-instructions")
    @PreAuthorize("hasRole('PLAYER')")
    public ApiResponse<RescheduleService.Instructions> rescheduleInstructions(@AuthenticationPrincipal UserPrincipal user,@PathVariable("id") Long id) {
        return ApiResponse.success(reschedules.instructions(user,id));
    }

    @PostMapping("/api/reschedule-requests/{id}/payments")
    @PreAuthorize("hasRole('PLAYER')")
    public ApiResponse<RescheduleRequest> submitReschedulePayment(@AuthenticationPrincipal UserPrincipal user,@PathVariable("id") Long id,
            @RequestPart(value="proof",required=false) MultipartFile proof) {
        return ApiResponse.success(reschedules.submit(user,id,proof));
    }
}
