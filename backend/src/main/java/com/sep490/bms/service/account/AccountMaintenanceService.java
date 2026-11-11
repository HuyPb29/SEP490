package com.sep490.bms.service.account;

import java.time.LocalDateTime;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.repository.account.AccountRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mở khóa tài khoản hết hạn khóa tạm thời và dọn nhật ký, dữ liệu đăng ký chờ.
 */
@Service @RequiredArgsConstructor
public class AccountMaintenanceService {
    private final AccountRepository accounts;
    private final EntityManager em;

    @Transactional
    public int unlockExpired(LocalDateTime now) {
        int count=0;
        for(var observed:accounts.findByStatusAndLockedUntilLessThanEqual(AccountStatus.LOCKED,now)) {
            var account=accounts.findByIdForUpdate(observed.getId()).orElse(null);
            if(account==null) continue;
            em.refresh(account,LockModeType.PESSIMISTIC_WRITE);
            if(account.getStatus()!=AccountStatus.LOCKED || account.getLockedUntil()==null || account.getLockedUntil().isAfter(now)) continue;
            account.setStatus(AccountStatus.ACTIVE);account.setLockedUntil(null);account.setFailedLoginCount(0);account.setUpdatedAt(now);count++;
        }
        return count;
    }
    @Transactional
    public int purgeAuditBatch(LocalDateTime cutoff) {
        return em.createNativeQuery("DELETE TOP (5000) FROM account_audit WHERE created_at < :cutoff").setParameter("cutoff",cutoff).executeUpdate();
    }
    @Transactional
    public int discardExpiredRegistrations(LocalDateTime now) {
        return em.createQuery("update OtpRequest o set o.pendingData=null,o.usedAt=:now where o.purpose=com.sep490.bms.entity.account.OtpPurpose.REGISTER and o.pendingData is not null and o.expiresAt<=:now")
                .setParameter("now",now).executeUpdate();
    }
}
