package com.sep490.bms.service.notification;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Sends invalidations only. All data is re-read through the existing authorized APIs. */
@Service
public class RealtimeUpdates {
    private final ConcurrentHashMap<SseEmitter, Long> clients = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long userId) {
        // Periodic reconnect rechecks JWT revocation and account/location access.
        SseEmitter emitter = new SseEmitter(60_000L);
        clients.put(emitter, userId);
        emitter.onCompletion(() -> clients.remove(emitter));
        emitter.onTimeout(() -> disconnect(emitter));
        emitter.onError(error -> clients.remove(emitter));
        send(emitter, "ready");
        return emitter;
    }

    public void changed(Long recipientId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()
                && TransactionSynchronizationManager.isActualTransactionActive()) {
            boolean queued = TransactionSynchronizationManager.getSynchronizations().stream()
                    .anyMatch(sync -> sync instanceof Change change
                            && (change.recipientId == null || java.util.Objects.equals(change.recipientId, recipientId)));
            if (!queued) TransactionSynchronizationManager.registerSynchronization(new Change(recipientId));
        } else broadcast(recipientId);
    }

    private class Change implements TransactionSynchronization {
        private final Long recipientId;
        Change(Long recipientId) { this.recipientId = recipientId; }
        @Override public void afterCommit() { broadcast(recipientId); }
    }

    private void broadcast(Long recipientId) {
        clients.forEach((emitter, userId) -> {
            if (recipientId == null || recipientId.equals(userId)) send(emitter, "changed");
        });
    }

    @Scheduled(fixedDelay = 15_000L)
    public void heartbeat() { clients.keySet().forEach(emitter -> send(emitter, "ping")); }

    private void send(SseEmitter emitter, String event) {
        try {
            synchronized (emitter) { emitter.send(SseEmitter.event().name(event).data("{}")); }
        } catch (IOException | RuntimeException error) {
            disconnect(emitter);
        }
    }

    private void disconnect(SseEmitter emitter) {
        clients.remove(emitter);
        try { emitter.complete(); } catch (RuntimeException ignored) { /* A closed socket cannot fail the committed write. */ }
    }
}
