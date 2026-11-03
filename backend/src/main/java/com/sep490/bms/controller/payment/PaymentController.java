package com.sep490.bms.controller.payment;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.payment.PaymentInstructionResponse;
import com.sep490.bms.dto.payment.PaymentResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.payment.PaymentService;

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

    private final PaymentService paymentService;

    /**
     * UC18 – Thanh toán booking (#1: số tiền, tài khoản, QR, thời gian giữ chỗ còn lại)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/bookings/{id}/payment-instructions")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PaymentInstructionResponse>> getBookingsByIdPaymentInstructions(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getInstructions(currentUser, id)));
    }

    /**
     * UC18 – Thanh toán booking (#1: ảnh mã QR để hiện và lưu về máy; chỉ trả qua API có kiểm tra quyền, A03)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/bookings/{id}/payment-instructions/qr")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<Resource> getBookingsByIdPaymentInstructionsQr(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Resource image = paymentService.loadQrImage(currentUser, id);
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(image).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(image);
    }

    /**
     * UC18 – Thanh toán booking (#2, #3: multipart ảnh chứng từ; tạo payment + payment_proof)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Ảnh gửi ở phần "proof" của form multipart. Không gửi ảnh thì service báo MSG106.
     */
    @PostMapping("/api/bookings/{id}/payments")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PaymentResponse>> postBookingsByIdPayments(
            @PathVariable("id") Long id,
            @RequestParam(value = "proof", required = false) MultipartFile proof,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã báo thanh toán. Vui lòng chờ nhân viên xác nhận.",
                        paymentService.submitProof(currentUser, id, proof)));
    }

    /**
     * UC18 – Thanh toán booking (gói đặt nhiều buổi, UC15 #7: thanh toán toàn bộ một lần)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
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
     * Status: NOT_IMPLEMENTED
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
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/payments/{id}")
    public ResponseEntity<Void> getPaymentsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC18 – Thanh toán booking (#4: gửi lại chứng từ khi được yêu cầu bổ sung)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Ảnh gửi ở phần "proof" của form multipart, như lúc báo đã thanh toán.
     */
    @PostMapping("/api/payments/{id}/resubmit")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PaymentResponse>> postPaymentsByIdResubmit(
            @PathVariable("id") Long id,
            @RequestParam(value = "proof", required = false) MultipartFile proof,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success("Đã báo thanh toán. Vui lòng chờ nhân viên xác nhận.",
                paymentService.resubmitProof(currentUser, id, proof)));
    }

    /**
     * UC19 – Xác nhận thanh toán
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/payments")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<Void> getStaffPayments() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC19 – Xác nhận thanh toán
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/payments/{id}")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<Void> getStaffPaymentsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC19 – Xác nhận thanh toán (#3, #6, #7: nhập số tiền thực nhận khi chuyển thừa)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/payments/{id}/confirm")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<Void> postStaffPaymentsByIdConfirm(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC19 – Xác nhận thanh toán (#5)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/payments/{id}/reject")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<Void> postStaffPaymentsByIdReject(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC19 – Xác nhận thanh toán (#4)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/payments/{id}/request-resubmission")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<Void> postStaffPaymentsByIdRequestResubmission(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** Payment for the positive difference on a reschedule request; service pending. */
    @GetMapping("/api/reschedule-requests/{id}/payment-instructions")
    public ResponseEntity<Void> rescheduleInstructions(@PathVariable("id") Long id) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    @PostMapping("/api/reschedule-requests/{id}/payments")
    public ResponseEntity<Void> submitReschedulePayment(@PathVariable("id") Long id) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
