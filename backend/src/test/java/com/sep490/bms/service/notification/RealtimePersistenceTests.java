package com.sep490.bms.service.notification;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.sep490.bms.entity.notification.Notification;
import jakarta.persistence.EntityManager;

@SpringBootTest(properties={"bms.job.enabled=false","bms.scheduler.match-sweep.enabled=false"})
class RealtimePersistenceTests {
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired RealtimeUpdates updates;

    @Test @SuppressWarnings("unchecked")
    void entityManagerNotificationUsesTheManagedListenerAndRollbackKeepsClientsQuiet() throws Exception {
        Long recipient=jdbc.queryForObject("SELECT TOP 1 id FROM account ORDER BY id",Long.class);
        SseEmitter client=mock(SseEmitter.class);
        Map<SseEmitter,Long> clients=(Map<SseEmitter,Long>)ReflectionTestUtils.getField(updates,"clients");
        clients.put(client,recipient);
        try {
            new TransactionTemplate(transactions).executeWithoutResult(status->{
                em.persist(Notification.builder().recipientId(recipient).type("BOOKING_HOLD_EXPIRED")
                        .title("Realtime rollback test").content("Temporary transaction fixture").build());
                em.flush();
                assertThat(TransactionSynchronizationManager.getSynchronizations())
                        .anyMatch(sync->sync.getClass().getName().contains("RealtimeUpdates$Change"));
                status.setRollbackOnly();
            });
            verifyNoInteractions(client);
        } finally { clients.remove(client); }
    }
}
