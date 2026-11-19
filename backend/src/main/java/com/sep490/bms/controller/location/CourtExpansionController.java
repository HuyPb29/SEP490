package com.sep490.bms.controller.location;

import java.util.List;
import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.location.CourtExpansionDtos.*;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.CourtExpansionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequiredArgsConstructor
public class CourtExpansionController {
    private final CourtExpansionService service;

    @GetMapping("/api/owner/locations/{locationId}/court-expansions/quote")
    public ApiResponse<Quote> quote(@AuthenticationPrincipal UserPrincipal owner, @PathVariable Long locationId, @RequestParam int courtCount) {
        return ApiResponse.success(service.quote(owner, locationId, courtCount));
    }
    @GetMapping("/api/owner/locations/{locationId}/court-expansions")
    public ApiResponse<List<View>> ownerList(@AuthenticationPrincipal UserPrincipal owner, @PathVariable Long locationId) {
        return ApiResponse.success(service.ownerList(owner, locationId));
    }
    @PostMapping(value="/api/owner/locations/{locationId}/court-expansions", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<View> submit(@AuthenticationPrincipal UserPrincipal owner, @PathVariable Long locationId,
            @Valid @RequestPart("data") Submit data, @RequestPart("proof") MultipartFile proof) {
        return ApiResponse.success(service.submit(owner, locationId, data, proof));
    }
    @GetMapping("/api/admin/court-expansions")
    public ApiResponse<List<View>> adminList() { return ApiResponse.success(service.adminList()); }
    @PostMapping("/api/admin/court-expansions/{id}/approve")
    public ApiResponse<View> approve(@AuthenticationPrincipal UserPrincipal admin, @PathVariable Long id, @Valid @RequestBody Decision data) {
        return ApiResponse.success(service.decide(admin, id, data, true));
    }
    @PostMapping("/api/admin/court-expansions/{id}/reject")
    public ApiResponse<View> reject(@AuthenticationPrincipal UserPrincipal admin, @PathVariable Long id, @Valid @RequestBody Decision data) {
        return ApiResponse.success(service.decide(admin, id, data, false));
    }
    @GetMapping({"/api/admin/court-expansions/{id}/proof", "/api/owner/court-expansions/{id}/proof"})
    public ResponseEntity<Resource> proof(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        Resource image = service.proof(user, id);
        return ResponseEntity.ok().contentType(MediaTypeFactory.getMediaType(image).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .cacheControl(CacheControl.noStore()).body(image);
    }
}
