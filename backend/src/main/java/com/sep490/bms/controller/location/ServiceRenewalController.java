package com.sep490.bms.controller.location;

import java.util.List;
import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.ServiceRenewalDtos.*;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.ServiceRenewalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequiredArgsConstructor
public class ServiceRenewalController {
    private final ServiceRenewalService service;
    @GetMapping("/api/owner/locations/{id}/service-renewals/quote")
    public ApiResponse<Quote> quote(@AuthenticationPrincipal UserPrincipal owner, @PathVariable Long id, @RequestParam int years) {
        return ApiResponse.success(service.quote(owner, id, years));
    }
    @GetMapping("/api/owner/locations/{id}/service-renewals")
    public ApiResponse<List<View>> ownerList(@AuthenticationPrincipal UserPrincipal owner, @PathVariable Long id) {
        return ApiResponse.success(service.ownerList(owner, id));
    }
    @PostMapping(value="/api/owner/locations/{id}/service-renewals", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<View> submit(@AuthenticationPrincipal UserPrincipal owner, @PathVariable Long id,
            @Valid @RequestPart("data") Submit data, @RequestPart("proof") MultipartFile proof) {
        return ApiResponse.success(service.submit(owner, id, data, proof));
    }
    @GetMapping("/api/admin/service-renewals")
    public ApiResponse<List<View>> adminList() { return ApiResponse.success(service.adminList()); }
    @PostMapping("/api/admin/service-renewals/{id}/approve")
    public ApiResponse<View> approve(@AuthenticationPrincipal UserPrincipal admin, @PathVariable Long id, @Valid @RequestBody Decision data) {
        return ApiResponse.success(service.decide(admin, id, data, true));
    }
    @PostMapping("/api/admin/service-renewals/{id}/reject")
    public ApiResponse<View> reject(@AuthenticationPrincipal UserPrincipal admin, @PathVariable Long id, @Valid @RequestBody Decision data) {
        return ApiResponse.success(service.decide(admin, id, data, false));
    }
    @GetMapping({"/api/admin/service-renewals/{id}/proof", "/api/owner/service-renewals/{id}/proof"})
    public ResponseEntity<Resource> proof(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        Resource image = service.proof(user, id);
        return ResponseEntity.ok().header("X-Content-Type-Options", "nosniff")
                .contentType(MediaTypeFactory.getMediaType(image).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .cacheControl(CacheControl.noStore()).body(image);
    }
}
