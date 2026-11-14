package com.sep490.bms.controller.promotion;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.sep490.bms.common.*;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import com.sep490.bms.entity.enums.PointTransactionType;
import com.sep490.bms.service.promotion.LoyaltyPointService;
import org.springframework.http.*;
/**
 * Cung cấp API xem số dư, lịch sử điểm và cho Owner cộng điểm thủ công.
 */
@RestController @RequiredArgsConstructor
@io.swagger.v3.oas.annotations.tags.Tag(name="F6 - UC25 Points (SRS UC20)")
public class LoyaltyPointController {
 private final LoyaltyPointService service;
 @GetMapping("/api/me/loyalty-balances") @PreAuthorize("hasRole('PLAYER')")
 public ApiResponse<PageResponse<LoyaltyBalanceResponse>> balances(@AuthenticationPrincipal UserPrincipal user,
  @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
  return ApiResponse.success(service.balances(user,page,size));
 }
 @GetMapping("/api/me/loyalty-transactions") @PreAuthorize("hasRole('PLAYER')")
 public ApiResponse<PageResponse<PointTransactionResponse>> history(@AuthenticationPrincipal UserPrincipal user,
  @RequestParam(required=false) Long locationId,@RequestParam(required=false) PointTransactionType type,
  @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
  return ApiResponse.success(service.history(user,locationId,type,page,size));
 }
 @GetMapping("/api/owner/loyalty-adjustments/players") @PreAuthorize("hasRole('OWNER')")
 public ApiResponse<PageResponse<PointGrantPlayerResponse>> pointGrantPlayers(@AuthenticationPrincipal UserPrincipal user,
  @RequestParam(defaultValue="") String q,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
  return ApiResponse.success(service.pointGrantPlayers(user,q,page,size));
 }
 @GetMapping("/api/owner/loyalty-adjustments/players/{playerId}/bookings") @PreAuthorize("hasRole('OWNER')")
 public ApiResponse<PageResponse<PointGrantBookingResponse>> pointGrantBookings(@AuthenticationPrincipal UserPrincipal user,
  @PathVariable Long playerId,@RequestParam(defaultValue="") String q,
  @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
  return ApiResponse.success(service.pointGrantBookings(user,playerId,q,page,size));
 }
 @PostMapping("/api/owner/loyalty-adjustments") @PreAuthorize("hasRole('OWNER')")
 public ResponseEntity<ApiResponse<PointTransactionResponse>> adjust(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody LoyaltyAdjustmentRequest request) {
  return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(service.adjust(user,request)));
 }
}
