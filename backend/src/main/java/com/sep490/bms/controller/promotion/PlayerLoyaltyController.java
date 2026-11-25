package com.sep490.bms.controller.promotion;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.promotion.PlayerLoyaltyProgressResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.promotion.PlayerLoyaltyProgressService;
import lombok.RequiredArgsConstructor;

/** API chỉ đọc tiến độ thưởng tại ví địa điểm của Player đang đăng nhập. */
@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLAYER')")
@io.swagger.v3.oas.annotations.tags.Tag(name="F6 - UC26 Loyalty Rewards")
public class PlayerLoyaltyController {
    private final PlayerLoyaltyProgressService service;

    @GetMapping("/api/me/loyalty-milestones")
    public ApiResponse<PlayerLoyaltyProgressResponse> progress(
            @AuthenticationPrincipal UserPrincipal user, @RequestParam Long locationId) {
        return ApiResponse.success(service.progress(user, locationId));
    }
}
