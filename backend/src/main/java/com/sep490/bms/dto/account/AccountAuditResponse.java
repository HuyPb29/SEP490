package com.sep490.bms.dto.account;

import java.time.LocalDateTime;
import com.sep490.bms.entity.account.AccountAudit;
import com.sep490.bms.entity.account.AccountAuditAction;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;

public record AccountAuditResponse(Long id, Long actorId, Role actorRole, Long targetAccountId,
        Long locationId, AccountAuditAction action, AccountStatus previousStatus, AccountStatus newStatus,
        String reason, String outcome, LocalDateTime createdAt) {
    public static AccountAuditResponse from(AccountAudit a) {
        return new AccountAuditResponse(a.getId(), a.getActorId(), a.getActorRole(), a.getTargetAccountId(),
                a.getLocationId(), a.getAction(), a.getPreviousStatus(), a.getNewStatus(), a.getReason(),
                a.getOutcome(), a.getCreatedAt());
    }
}
