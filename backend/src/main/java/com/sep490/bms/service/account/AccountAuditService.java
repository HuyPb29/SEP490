package com.sep490.bms.service.account;

import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountAudit;
import com.sep490.bms.entity.account.AccountAuditAction;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.repository.account.AccountAuditRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ghi sự kiện tài khoản trong cùng giao dịch với thay đổi tài khoản.
 */
@Service
@RequiredArgsConstructor
public class AccountAuditService {
    private final AccountAuditRepository audits;

    /** Audit and mutation commit together; a failed audit must roll back the account operation. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(Long actorId, Role actorRole, Account target, AccountAuditAction action,
                       AccountStatus previousStatus, String reason) {
        audits.save(AccountAudit.builder().actorId(actorId).actorRole(actorRole)
                .targetAccountId(target.getId()).locationId(target.getLocationId()).action(action)
                .previousStatus(previousStatus).newStatus(target.getStatus())
                .reason(reason == null || reason.isBlank() ? null : reason.trim())
                .outcome("SUCCESS").build());
    }

}
