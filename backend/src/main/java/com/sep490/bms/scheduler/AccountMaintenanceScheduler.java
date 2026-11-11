package com.sep490.bms.scheduler;

import java.time.LocalDateTime;
import com.sep490.bms.service.account.AccountMaintenanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** SRS JOB-11/JOB-12. Retry/batch work never sleeps inside the scheduler thread. */
@Component @RequiredArgsConstructor @Slf4j
@ConditionalOnProperty(name="bms.job.enabled",havingValue="true",matchIfMissing=true)
public class AccountMaintenanceScheduler {
    private final AccountMaintenanceService service;
    @Value("${app.audit.retention-days:90}") private int retentionDays;
    private int unlockRetries;
    private boolean moreAudit;
    private LocalDateTime auditCutoff;
    private LocalDateTime nextAuditBatchAt;
    private LocalDateTime nextUnlockAttempt;

    @Scheduled(cron="0 */15 * * * *")
    public synchronized void unlock() { unlockRetries=0; attemptUnlock(); }
    private void attemptUnlock() {
        try { log.info("JOB-11 unlocked {} accounts",service.unlockExpired(LocalDateTime.now()));unlockRetries=0; }
        catch(RuntimeException error) { unlockRetries++;nextUnlockAttempt=LocalDateTime.now().plusSeconds(30);log.error("JOB-11 failed (attempt {})",unlockRetries,error); }
    }
    @Scheduled(fixedDelay=30000)
    public synchronized void retryUnlock() {
        if(unlockRetries>0 && unlockRetries<=3 && !LocalDateTime.now().isBefore(nextUnlockAttempt)) { attemptUnlock();if(unlockRetries>3) log.error("JOB-11 retry limit reached; waiting for next run"); }
    }
    @Scheduled(cron="0 0 2 * * *")
    public synchronized void purgeAudit() {
        auditCutoff=LocalDateTime.now().minusDays(retentionDays>0?retentionDays:90);
        moreAudit=true;purgeBatch();
    }
    @Scheduled(fixedDelay=300000)
    public synchronized void nextAuditBatch() { if(moreAudit && !LocalDateTime.now().isBefore(nextAuditBatchAt)) purgeBatch(); }
    private void purgeBatch() {
        try { int deleted=service.purgeAuditBatch(auditCutoff);moreAudit=deleted==5000;nextAuditBatchAt=LocalDateTime.now().plusMinutes(5);log.info("JOB-12 deleted {} audit entries",deleted); }
        catch(RuntimeException error) { moreAudit=false;log.warn("JOB-12 failed; waiting for next scheduled run",error); }
    }
    @Scheduled(fixedDelay=60000)
    public void discardExpiredRegistrations() { service.discardExpiredRegistrations(LocalDateTime.now()); }
}
