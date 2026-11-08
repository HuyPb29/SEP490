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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.payment.ConfirmPaymentRequest;
import com.sep490.bms.dto.payment.PaymentDetailResponse;
import com.sep490.bms.dto.payment.PaymentInstructionResponse;
import com.sep490.bms.dto.payment.PaymentResponse;
import com.sep490.bms.dto.payment.RejectPaymentRequest;
import com.sep490.bms.dto.payment.ResubmitRequest;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.payment.PaymentService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Feature: F4 – Thanh toán
 * Owner: Minh
 * UC: UC18 – Thanh toán booking; UC19 – Xác nhận thanh toán
 *
 * Payment chỉ được tạo khi Player gửi chứng từ (bảng payment mặc định AWAITING_CONFIRMATION,
 * không có trạng thái "chờ gửi"), nên bước xem hướng dẫn và gửi chứng từ đi theo id booking/gói.
 * Sau khi gộp UC21, các handler booking UC18–19 ở đây giữ contract của MinhDD.
 * Phụ thu đổi lịch nằm trong ReschedulePaymentController với route riêng;
 * không chuyển payment phụ thu vào PaymentService vì service này xử lý booking lẻ.
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
     * UC18 – Thanh toán booking (gói đặt nhiều buổi, UC15 #7: số tiền cả gói, tài khoản, QR, giờ hết giữ chỗ)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/booking-packages/{id}/payment-instructions")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PaymentInstructionResponse>> getBookingPackagesByIdPaymentInstructions(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPackageInstructions(currentUser, id)));
    }

    /**
     * UC18 – Thanh toán booking (gói đặt nhiều buổi: ảnh mã QR, chỉ trả qua API có kiểm tra quyền, A03)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/booking-packages/{id}/payment-instructions/qr")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<Resource> getBookingPackagesByIdPaymentInstructionsQr(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Resource image = paymentService.loadPackageQrImage(currentUser, id);
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(image).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(image);
    }

    /**
     * UC18 – Thanh toán booking (gói đặt nhiều buổi, UC15 #7: báo đã thanh toán cả gói một lần; multipart ảnh
     * chứng từ ở phần "proof")
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Gửi lại chứng từ của gói dùng POST /api/payments/{id}/resubmit như booking lẻ.
     */
    @PostMapping("/api/booking-packages/{id}/payments")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PaymentResponse>> postBookingPackagesByIdPayments(
            @PathVariable("id") Long id,
            @RequestParam(value = "proof", required = false) MultipartFile proof,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã báo thanh toán. Vui lòng chờ nhân viên xác nhận.",
                        paymentService.submitPackageProof(currentUser, id, proof)));
    }

    /**
     * UC18 – Thanh toán booking (#5: trạng thái thanh toán, biên nhận)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/payments/{id}")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PaymentResponse>> getPaymentsById(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPayment(currentUser, id)));
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
     * UC18, UC19 – Ảnh chứng từ của một giao dịch (A03: không có thư mục ảnh công khai)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Player đặt booking, Staff của địa điểm, Owner của địa điểm đang chọn (X-Location-Id) xem được; người khác 403.
     */
    @GetMapping("/api/payments/{id}/proofs/{proofId}/image")
    @PreAuthorize("hasAnyRole('PLAYER', 'STAFF', 'OWNER')")
    public ResponseEntity<Resource> getPaymentsByIdProofsByProofIdImage(
            @PathVariable("id") Long id,
            @PathVariable("proofId") Long proofId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Resource image = paymentService.loadProofImage(currentUser, id, proofId);
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(image).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(image);
    }

    /**
     * UC19 – Xác nhận thanh toán (#1: danh sách giao dịch chờ xác nhận, gửi sớm nhất lên đầu)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Staff xem địa điểm của mình; Owner làm thay Staff (BR58) gửi header X-Location-Id.
     */
    @GetMapping("/api/staff/payments")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<ApiResponse<PageResponse<PaymentResponse>>> getStaffPayments(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.listPending(currentUser, page, size)));
    }

    /**
     * UC19 – Xác nhận thanh toán (#2: chi tiết giao dịch, chứng từ, ghi chú cho chủ sân)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @GetMapping("/api/staff/payments/{id}")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<ApiResponse<PaymentDetailResponse>> getStaffPaymentsById(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPendingDetail(currentUser, id)));
    }

    /**
     * UC19 – Xác nhận thanh toán (#3, #6, #7: xác nhận, sinh biên nhận; nhập số tiền thực nhận khi chuyển thừa)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     * Body không bắt buộc: không gửi receivedAmount nghĩa là nhận đúng số phải trả.
     */
    @PostMapping("/api/staff/payments/{id}/confirm")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<ApiResponse<PaymentResponse>> postStaffPaymentsByIdConfirm(
            @PathVariable("id") Long id,
            @Valid @RequestBody(required = false) ConfirmPaymentRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        PaymentResponse result = paymentService.confirm(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success(
                "Đã xác nhận thanh toán booking " + result.getBookingCode() + ".", result));
    }

    /**
     * UC19 – Xác nhận thanh toán (#5: từ chối, nhả slot, trả voucher và điểm)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @PostMapping("/api/staff/payments/{id}/reject")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<ApiResponse<PaymentResponse>> postStaffPaymentsByIdReject(
            @PathVariable("id") Long id,
            @Valid @RequestBody RejectPaymentRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success("Đã từ chối giao dịch.",
                paymentService.reject(currentUser, id, request)));
    }

    /**
     * UC19 – Xác nhận thanh toán (#4: yêu cầu bổ sung; lỗi do Player mà hết lượt thì từ chối luôn, BR34)
     * Feature: F4 – Thanh toán
     * Owner: Minh
     */
    @PostMapping("/api/staff/payments/{id}/request-resubmission")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<ApiResponse<PaymentResponse>> postStaffPaymentsByIdRequestResubmission(
            @PathVariable("id") Long id,
            @Valid @RequestBody ResubmitRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        PaymentResponse result = paymentService.requestResubmission(currentUser, id, request);
        String message = result.getStatus() == PaymentStatus.REJECTED
                ? "Player đã hết lượt gửi lại chứng từ; giao dịch bị từ chối."
                : "Đã yêu cầu Player bổ sung.";
        return ResponseEntity.ok(ApiResponse.success(message, result));
    }

}
