package com.sep490.bms.service.account;

import java.util.ArrayList;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.account.AccountAuditResponse;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountAudit;
import com.sep490.bms.entity.account.AccountAuditAction;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountAuditRepository;
import com.sep490.bms.security.UserPrincipal;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ghi sự kiện tài khoản và phục vụ Admin tra cứu nhật ký.
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

    @Transactional(readOnly = true)
    public PageResponse<AccountAuditResponse> list(UserPrincipal user, Long actorId, Long targetAccountId,
            AccountAuditAction action, int page, int size) {
        if (user == null || user.getRole() != Role.ADMIN) throw new AppException("Chỉ Admin được xem audit", HttpStatus.FORBIDDEN);
        if (page < 0 || size < 1 || size > 100 || actorId != null && actorId <= 0
                || targetAccountId != null && targetAccountId <= 0) throw new AppException("Bộ lọc/phân trang không hợp lệ");
        var result = audits.findAll((root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (actorId != null) predicates.add(cb.equal(root.get("actorId"), actorId));
            if (targetAccountId != null) predicates.add(cb.equal(root.get("targetAccountId"), targetAccountId));
            if (action != null) predicates.add(cb.equal(root.get("action"), action));
            return cb.and(predicates.toArray(new Predicate[0]));
        }, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")));
        return PageResponse.from(result.map(AccountAuditResponse::from));
    }
}
