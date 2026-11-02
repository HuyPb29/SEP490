package com.sep490.bms.controller.account;

import com.sep490.bms.common.*;
import com.sep490.bms.dto.AccountAuditResponse;
import com.sep490.bms.entity.AccountAuditAction;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.AccountAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class AccountAuditController {
    private final AccountAuditService audits;

    @GetMapping("/api/admin/account-audits")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PageResponse<AccountAuditResponse>> list(@AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) Long actorId, @RequestParam(required = false) Long targetAccountId,
            @RequestParam(required = false) AccountAuditAction action,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(audits.list(user, actorId, targetAccountId, action, page, size));
    }
}
