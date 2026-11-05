package com.sep490.bms.scheduler;

import java.time.LocalDateTime;
import com.sep490.bms.service.reschedule.*;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

/** Separate transaction per item: one invalid record must not prevent all other deadlines from being processed. */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name="app.booking-change.jobs-enabled",havingValue="true",matchIfMissing=true)
@RequiredArgsConstructor
@Slf4j
public class BookingChangeScheduler {
    private final EntityManager em;
    private final PlatformTransactionManager transactions;
    private final RescheduleService reschedules;
    private final CancellationService cancellations;

    @Scheduled(fixedDelayString="${app.booking-change.scan-ms:30000}",initialDelayString="${app.booking-change.scan-ms:30000}")
    public void scan() {
        var tx=new TransactionTemplate(transactions);
        var requests=tx.execute(s->em.createQuery("select r.id from RescheduleRequest r where (r.status='PENDING_PAYMENT' and r.holdExpiresAt<=:now) or (r.status in ('PENDING_PAYMENT','AWAITING_CONFIRMATION') and r.approveDeadline<=:now) order by r.id",Long.class)
                .setParameter("now",LocalDateTime.now()).getResultList());
        if(requests!=null) for(Long id:requests) try { reschedules.expireRequest(id); } catch(Exception e) { log.error("Cannot expire reschedule {}",id,e); }
        var affected=tx.execute(s->em.createQuery("select a.id from AffectedBooking a where a.status='PENDING' order by a.id",Long.class).getResultList());
        if(affected!=null) for(Long id:affected) try { cancellations.defaultChoice(id); } catch(Exception e) { log.error("Cannot settle affected booking {}",id,e); }
    }
}
