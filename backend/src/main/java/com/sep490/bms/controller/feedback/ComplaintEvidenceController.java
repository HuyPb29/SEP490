package com.sep490.bms.controller.feedback;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.feedback.*;
import com.sep490.bms.entity.feedback.Complaint;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.feedback.ComplaintEvidenceService;
import com.sep490.bms.service.feedback.ComplaintService;

/** API gửi và xem ảnh khiếu nại riêng tư, không thay hợp đồng JSON của API khiếu nại hiện có. */
@RestController @RequiredArgsConstructor @PreAuthorize("isAuthenticated()")
public class ComplaintEvidenceController {
    private final ComplaintEvidenceService service;

    @PostMapping(value="/api/complaints/with-evidence", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<ComplaintResponse>> create(@AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestPart("data") CreateComplaintRequest data, @RequestPart("evidence") MultipartFile image) {
        ComplaintResponse complaint = service.create(user, data, image);
        String message = Complaint.TYPE_LATE_PAYMENT_CONFIRMATION.equals(complaint.getComplaintType())
                ? ComplaintService.MSG88 : "Đã gửi khiếu nại";
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(message, complaint));
    }

    @GetMapping("/api/complaints/{id}/evidence")
    public ApiResponse<ComplaintEvidenceResponse> metadata(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        return ApiResponse.success(service.metadata(user, id));
    }

    @GetMapping("/api/complaints/{id}/evidence/image")
    public ResponseEntity<Resource> image(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        Resource image = service.image(user, id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Content-Type-Options", "nosniff")
                .contentType(MediaTypeFactory.getMediaType(image).orElse(MediaType.APPLICATION_OCTET_STREAM)).body(image);
    }
}
