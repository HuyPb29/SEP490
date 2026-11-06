package com.sep490.bms.scheduler;
import com.sep490.bms.service.payment.PackagePaymentService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

@Component @RequiredArgsConstructor @Slf4j
@ConditionalOnProperty(name="bms.job.enabled",havingValue="true",matchIfMissing=true)
public class PackageExpiryScheduler {
    private final EntityManager em;
    private final PlatformTransactionManager transactions;
    private final PackagePaymentService payments;
    @Scheduled(fixedDelay=30000)
    public void expire() {
        var ids=new TransactionTemplate(transactions).execute(s->em.createQuery("select p.id from BookingPackage p where p.status in ('HOLDING','AWAITING_CONFIRMATION','RESUBMIT_REQUESTED') order by p.id",Long.class).getResultList());
        if(ids!=null) for(Long id:ids) try { payments.expire(id); } catch(RuntimeException error) { log.error("Cannot expire package {}",id,error); }
    }
}
