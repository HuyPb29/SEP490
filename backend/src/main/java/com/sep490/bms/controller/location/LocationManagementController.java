package com.sep490.bms.controller.location;

import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.AdminLocationDto;
import com.sep490.bms.dto.location.LocationDetailDto;
import com.sep490.bms.dto.location.UpdateLocationRequest;
import com.sep490.bms.dto.location.UpdateLocationStatusRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.AdminLocationService;
import com.sep490.bms.service.location.LocationManagementService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * Cho Admin quản lý trạng thái địa điểm và Owner cập nhật địa điểm thuộc quyền quản lý.
 *
 * Feature: F2 – Quản lý địa điểm
 * Owner: Minh Anh
 * UC: UC06 – Quản lý địa điểm sử dụng dịch vụ; UC07 – Quản lý địa điểm và sân
 */
@RestController
@RequiredArgsConstructor
public class LocationManagementController {

    private final LocationManagementService locationManagementService;
    private final AdminLocationService adminLocationService;

    @PostMapping(path = "/api/owner/locations/{id}/qr", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<String> uploadQr(@AuthenticationPrincipal UserPrincipal user, @PathVariable("id") Long id,
            @RequestParam("image") MultipartFile image) {
        return ApiResponse.success("Đã lưu ảnh QR", locationManagementService.uploadQr(user, id, image));
    }

    @GetMapping("/api/owner/locations/{id}/qr")
    public ResponseEntity<Resource> loadQr(@AuthenticationPrincipal UserPrincipal user, @PathVariable("id") Long id) {
        Resource image = locationManagementService.loadQr(user, id);
        return ResponseEntity.ok()
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaTypeFactory.getMediaType(image)
                        .filter(type -> type.equals(MediaType.IMAGE_JPEG) || type.equals(MediaType.IMAGE_PNG))
                        .orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(image);
    }

    /**
     * UC06 – Quản lý địa điểm sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     *
     * Lọc tuỳ chọn: ?status=ACTIVE|LOCKED
     */
    @GetMapping("/api/admin/locations")
    public ResponseEntity<ApiResponse<List<AdminLocationDto>>> getAdminLocations(
            @RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(adminLocationService.list(status)));
    }

    /**
     * UC06 – Quản lý địa điểm sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/admin/locations/{id}")
    public ResponseEntity<ApiResponse<AdminLocationDto>> getAdminLocationsById(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(adminLocationService.detail(id)));
    }

    /**
     * UC06 – Quản lý địa điểm sử dụng dịch vụ
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     *
     * Body: {"status":"LOCKED"} để khoá, {"status":"ACTIVE"} để mở lại.
     */
    @PatchMapping("/api/admin/locations/{id}")
    public ResponseEntity<ApiResponse<AdminLocationDto>> patchAdminLocationsById(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateLocationStatusRequest request) {
        AdminLocationDto updated = adminLocationService.updateStatus(id, request);
        return ResponseEntity.ok(ApiResponse.success(
                "LOCKED".equals(updated.getStatus()) ? "Đã khoá địa điểm" : "Đã mở lại địa điểm", updated));
    }

    /**
     * UC07 – Quản lý địa điểm và sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @GetMapping("/api/owner/locations")
    public ResponseEntity<ApiResponse<List<LocationDetailDto>>> getOwnerLocations(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(locationManagementService.listOwned(currentUser)));
    }

    /**
     * UC07 – Quản lý địa điểm và sân
     * Feature: F2 – Quản lý địa điểm
     * Owner: Minh Anh
     * Status: IMPLEMENTED
     */
    @PatchMapping("/api/owner/locations/{id}")
    public ResponseEntity<ApiResponse<LocationDetailDto>> patchOwnerLocationsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateLocationRequest request) {
        LocationDetailDto updated = locationManagementService.updateOwned(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật địa điểm thành công", updated));
    }
}
