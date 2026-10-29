package com.sep490.bms.controller.promotion;

import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.sep490.bms.common.*;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.dto.request.VoucherGrantRequest;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.promotion.VoucherService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController @RequiredArgsConstructor
@Tag(name="F6 - UC24 Vouchers", description="Voucher campaign và cấp cá nhân; tiêu/hoàn lượt chỉ ở transaction booking nội bộ")
public class VoucherController {
    private final VoucherService service;
    @GetMapping("/api/locations/{id}/vouchers") @SecurityRequirements
    @Operation(summary="Voucher công khai còn hiệu lực", description="Ẩn SPECIFIED/DRAFT/DISABLED; không giữ lượt, kiểm điều kiện cá nhân bằng check")
    public ApiResponse<PageResponse<VoucherResponse>> publicList(@PathVariable Long id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return ApiResponse.success(service.publicList(id,page,size));
    }
    @GetMapping("/api/me/vouchers") @PreAuthorize("hasRole('PLAYER')")
    @Operation(summary="Voucher được cấp cho Player hiện tại",description="Bao gồm lịch sử đã dùng/hết hạn")
    public ApiResponse<PageResponse<PersonalVoucherResponse>> personal(@AuthenticationPrincipal UserPrincipal user,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return ApiResponse.success(service.personalList(user,page,size));
    }
    @GetMapping("/api/owner/vouchers") @PreAuthorize("hasRole('OWNER')")
    @Operation(summary="Voucher trong facility chọn bằng X-Location-Id")
    public ApiResponse<PageResponse<VoucherResponse>> ownerList(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false) VoucherStatus status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return ApiResponse.success(service.ownerList(user,status,page,size));
    }
    @GetMapping("/api/admin/vouchers") @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary="Admin lọc voucher theo facility/trạng thái")
    public ApiResponse<PageResponse<VoucherResponse>> adminList(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false) Long locationId,@RequestParam(required=false) VoucherStatus status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return ApiResponse.success(service.adminList(user,locationId,status,page,size));
    }
    @PostMapping("/api/owner/vouchers") @PreAuthorize("hasRole('OWNER')")
    @Operation(summary="Tạo campaign DRAFT",description="Source CAMPAIGN; location lấy từ scope; code unique trong facility")
    public ResponseEntity<ApiResponse<VoucherResponse>> create(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody VoucherWriteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(service.create(user,request)));
    }
    @PatchMapping("/api/owner/vouchers/{id}") @PreAuthorize("hasRole('OWNER')")
    @Operation(summary="Thay toàn bộ cấu hình campaign DRAFT",description="Body gồm version và voucher đầy đủ; cấm sửa PUBLISHED/DISABLED")
    public ApiResponse<VoucherResponse> update(@AuthenticationPrincipal UserPrincipal user,@PathVariable Long id,@Valid @RequestBody VoucherUpdateRequest request) {
        return ApiResponse.success(service.update(user,id,request));
    }
    @PostMapping("/api/owner/vouchers/{id}/publish") @PreAuthorize("hasRole('OWNER')")
    @Operation(summary="Publish campaign; gọi lặp an toàn",description="Không publish lại DISABLED")
    public ApiResponse<VoucherResponse> publish(@AuthenticationPrincipal UserPrincipal user,@PathVariable Long id) { return ApiResponse.success(service.publish(user,id)); }
    @PostMapping("/api/admin/vouchers/{id}/disable") @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary="Chỉ Admin vô hiệu voucher; gọi lặp an toàn")
    public ApiResponse<VoucherResponse> disable(@AuthenticationPrincipal UserPrincipal user,@PathVariable Long id) { return ApiResponse.success(service.disable(user,id)); }
    @PostMapping("/api/owner/vouchers/{id}/grants") @PreAuthorize("hasRole('OWNER')")
    @Operation(summary="Cấp campaign SPECIFIED đã publish cho tối đa100 Player",description="Mỗi request cấp lượt mới; retry sẽ cấp thêm lượt")
    public ResponseEntity<ApiResponse<List<PersonalVoucherResponse>>> grant(@AuthenticationPrincipal UserPrincipal user,@PathVariable Long id,@Valid @RequestBody VoucherGrantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(service.grant(user,id,request)));
    }
    @PostMapping("/api/vouchers/check") @PreAuthorize("hasRole('PLAYER')")
    @Operation(summary="Kiểm điều kiện và tính giảm dự kiến",description="Không tiêu lượt/giữ ngân sách. Amount client chỉ để preview. F3 kiểm lại bằng giá DB trong transaction tạo booking.")
    public ApiResponse<VoucherCheckResponse> check(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody VoucherCheckRequest request) {
        throw new com.sep490.bms.exception.AppException("Chưa triển khai", HttpStatus.NOT_IMPLEMENTED);
    }
}
