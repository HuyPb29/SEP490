package com.sep490.bms.service.notification;

import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import java.util.Map;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class RealtimeUpdatesTests {
    RealtimeUpdates updates = new RealtimeUpdates();
    SseEmitter first = mock(SseEmitter.class), second = mock(SseEmitter.class);

    @BeforeEach @SuppressWarnings("unchecked")
    void clients() {
        Map<SseEmitter,Long> clients = (Map<SseEmitter,Long>)ReflectionTestUtils.getField(updates,"clients");
        clients.put(first,11L); clients.put(second,22L);
    }
    @AfterEach void cleanup() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(false);
    }
    @Test void notificationOnlyWakesItsRecipient() throws Exception {
        updates.changed(11L);
        verify(first).send(any(SseEmitter.SseEventBuilder.class)); verifyNoInteractions(second);
    }
    @Test void waitsForCommitAndCoalescesChangesInOneTransaction() throws Exception {
        TransactionSynchronizationManager.initSynchronization(); TransactionSynchronizationManager.setActualTransactionActive(true);
        updates.changed(11L); updates.changed(11L);
        verifyNoInteractions(first,second);
        assertThat(TransactionSynchronizationManager.getSynchronizations()).hasSize(1);
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(first,times(1)).send(any(SseEmitter.SseEventBuilder.class)); verifyNoInteractions(second);
    }
    @Test void rollbackDoesNotAnnounceAnUncommittedNotification() {
        TransactionSynchronizationManager.initSynchronization(); TransactionSynchronizationManager.setActualTransactionActive(true);
        updates.changed(11L);
        TransactionSynchronizationManager.getSynchronizations().forEach(sync->sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        verifyNoInteractions(first,second);
    }
    @Test void failedStreamDoesNotBreakOtherClientsOrTheWrite() throws Exception {
        doThrow(new java.io.IOException("disconnected")).when(first).send(any(SseEmitter.SseEventBuilder.class));
        doThrow(new IllegalStateException("already completed")).when(first).complete();
        assertThatCode(()->updates.changed(null)).doesNotThrowAnyException();
        verify(second).send(any(SseEmitter.SseEventBuilder.class));
        clearInvocations(first,second); updates.changed(null);
        verifyNoInteractions(first); verify(second).send(any(SseEmitter.SseEventBuilder.class));
    }
}
