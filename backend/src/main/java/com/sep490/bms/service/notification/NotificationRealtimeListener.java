package com.sep490.bms.service.notification;

import org.springframework.stereotype.Component;
import com.sep490.bms.entity.notification.Notification;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostUpdate;
import lombok.RequiredArgsConstructor;

/** Also covers notifications persisted directly through EntityManager by scheduled jobs. */
@Component
@RequiredArgsConstructor
public class NotificationRealtimeListener {
    private final RealtimeUpdates updates;

    @PostPersist @PostUpdate
    public void changed(Notification notification) { updates.changed(notification.getRecipientId()); }
}
