package com.sep490.bms.controller.promotion;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.sep490.bms.common.*;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import java.util.List;
import org.springframework.http.*;
import com.sep490.bms.service.promotion.LoyaltyMilestoneService;
@RestController @RequiredArgsConstructor @PreAuthorize("hasRole('OWNER')")
@io.swagger.v3.oas.annotations.tags.Tag(name="F6 - UC26 Loyalty (SRS UC18)")
public class LoyaltyMilestoneController {
 private final LoyaltyMilestoneService service;
 @GetMapping("/api/owner/loyalty-milestones")
 public ApiResponse<List<LoyaltyMilestoneResponse>> list(@AuthenticationPrincipal UserPrincipal user) { return ApiResponse.success(service.list(user)); }
 @PostMapping("/api/owner/loyalty-milestones")
 public ResponseEntity<ApiResponse<LoyaltyMilestoneResponse>> create(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody LoyaltyMilestoneRequest request) {
  return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(service.create(user,request)));
 }
 @PatchMapping("/api/owner/loyalty-milestones/{id}")
 public ApiResponse<LoyaltyMilestoneResponse> update(@AuthenticationPrincipal UserPrincipal user,@PathVariable Long id,@Valid @RequestBody LoyaltyMilestoneUpdateRequest request) {
  return ApiResponse.success(service.update(user,id,request));
 }
}
