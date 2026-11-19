package com.sep490.bms.controller.location;

import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.CreateServiceRegistrationRequest;
import com.sep490.bms.dto.location.OperatorPaymentInfoDto;
import com.sep490.bms.dto.location.RejectServiceRegistrationRequest;
import com.sep490.bms.dto.location.ServiceRegistrationDto;
import com.sep490.bms.dto.location.UpdateOperatorPaymentInfoRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.OperatorPaymentInfoService;
import com.sep490.bms.service.location.ServiceRegistrationService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Cung cấp API nộp, tra cứu và xét duyệt đơn đăng ký sử dụng dịch vụ,
 * và thông tin nhận chuyển khoản của bên vận hành hiện trên form đăng ký.
 *
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh (Leader code lại theo D168, D169)
 * UC: UC05 – Đăng ký sử dụng dịch vụ, UC06 – Quản lý địa điểm sử dụng dịch vụ
 */
@RestController
@RequiredArgsConstructor
public class ServiceRegistrationController {

    private final ServiceRegistrationService serviceRegistrationService;
    private final OperatorPaymentInfoService operatorPaymentInfoService;

    /**
     * UC05 – Đăng ký sử dụng dịch vụ (FR10)
     * Status: IMPLEMENTED
     *
     * multipart/form-data: phần "data" (JSON CreateServiceRegistrationRequest) và phần "proof" (ảnh chứng từ).
     */
    @PostMapping(path = "/api/service-registrations", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<ServiceRegistrationDto>> postServiceRegistrations(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestPart("data") CreateServiceRegistrationRequest request,
            @RequestPart(value = "proof", required = false) MultipartFile proof) {
        ServiceRegistrationDto created = serviceRegistrationService.submit(currentUser, request, proof);
        // MSG99
        String message = "Đã gửi yêu cầu đăng ký. Sau khi kiểm tra tiền thuê đã về, chúng tôi sẽ gửi kết quả tới email "
                + created.getContactEmail() + ".";
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(message, created));
    }

    /**
     * UC05 – Thông tin nhận chuyển khoản của bên vận hành và mức P35 để form tự tính tiền (FR10, FR127).
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/service-registrations/payment-info")
    public ApiResponse<OperatorPaymentInfoDto> getPaymentInfo() {
        return ApiResponse.success(operatorPaymentInfoService.get());
    }

    /**
     * UC05 – Ảnh QR chuyển khoản của bên vận hành; luôn có (ảnh Admin tải lên hoặc ảnh mặc định, D169).
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/service-registrations/payment-info/qr")
    public ResponseEntity<Resource> getPaymentQr() {
        return image(operatorPaymentInfoService.loadQr());
    }

    /**
     * UC05 – Owner xem các đơn đã gửi.
     * Status: IMPLEMENTED
     *
     * Lọc tuỳ chọn: ?status=PENDING|APPROVED|REJECTED
     */
    @GetMapping("/api/me/service-registrations")
    public ResponseEntity<ApiResponse<List<ServiceRegistrationDto>>> getMeServiceRegistrations(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(
                serviceRegistrationService.listMine(currentUser, status)));
    }

    /**
     * UC06 #1 – Admin xem danh sách đơn (kèm số tiền thuê, có ảnh chứng từ hay không).
     * Status: IMPLEMENTED
     *
     * Lọc tuỳ chọn: ?status=PENDING|APPROVED|REJECTED
     */
    @GetMapping("/api/admin/service-registrations")
    public ResponseEntity<ApiResponse<List<ServiceRegistrationDto>>> getAdminServiceRegistrations(
            @RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(serviceRegistrationService.listForAdmin(status)));
    }

    /**
     * UC06 #1 – Admin xem ảnh chứng từ chuyển khoản tiền thuê của đơn (FR11).
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/admin/service-registrations/{id}/proof")
    public ResponseEntity<Resource> getAdminServiceRegistrationProof(@PathVariable("id") Long id) {
        return image(serviceRegistrationService.loadProof(id));
    }

    /**
     * UC06 #2 – Admin duyệt đơn; hệ thống tạo địa điểm, tài khoản Owner và gửi email MSG116.
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/admin/service-registrations/{id}/approve")
    public ResponseEntity<ApiResponse<ServiceRegistrationDto>> postAdminServiceRegistrationsByIdApprove(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        ServiceRegistrationDto approved = serviceRegistrationService.approve(currentUser, id);
        return ResponseEntity.ok(ApiResponse.success(
                "Đã duyệt đơn đăng ký và gửi email kết quả tới " + approved.getContactEmail(), approved));
    }

    /**
     * UC06 #3 – Admin từ chối đơn, ghi lý do; hệ thống gửi email MSG117.
     * Status: IMPLEMENTED
     */
    @PostMapping("/api/admin/service-registrations/{id}/reject")
    public ResponseEntity<ApiResponse<ServiceRegistrationDto>> postAdminServiceRegistrationsByIdReject(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody RejectServiceRegistrationRequest request) {
        ServiceRegistrationDto rejected = serviceRegistrationService.reject(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success(
                "Đã từ chối đơn đăng ký và gửi email lý do tới chủ sân", rejected));
    }

    /**
     * UC06 #8 – Admin xem thông tin nhận chuyển khoản của bên vận hành (FR127).
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/admin/operator-payment-info")
    public ApiResponse<OperatorPaymentInfoDto> getAdminOperatorPaymentInfo() {
        return ApiResponse.success(operatorPaymentInfoService.get());
    }

    /**
     * UC06 #8 – Admin sửa ngân hàng, số tài khoản, tên chủ tài khoản của bên vận hành (FR127, DR28).
     * Status: IMPLEMENTED
     */
    @PutMapping("/api/admin/operator-payment-info")
    public ApiResponse<OperatorPaymentInfoDto> putAdminOperatorPaymentInfo(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody UpdateOperatorPaymentInfoRequest request) {
        return ApiResponse.success("Đã lưu thông tin nhận chuyển khoản",
                operatorPaymentInfoService.update(currentUser, request));
    }

    /**
     * UC06 #8 – Admin thay ảnh QR của bên vận hành (JPG/PNG, tối đa 5 MB, DR28).
     * Status: IMPLEMENTED
     */
    @PostMapping(path = "/api/admin/operator-payment-info/qr", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<OperatorPaymentInfoDto> postAdminOperatorPaymentQr(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam("image") MultipartFile image) {
        return ApiResponse.success("Đã lưu ảnh QR", operatorPaymentInfoService.uploadQr(currentUser, image));
    }

    private ResponseEntity<Resource> image(Resource image) {
        return ResponseEntity.ok()
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaTypeFactory.getMediaType(image)
                        .filter(type -> type.equals(MediaType.IMAGE_JPEG) || type.equals(MediaType.IMAGE_PNG))
                        .orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(image);
    }
}
