package com.sep490.bms.service.notification;

import org.springframework.stereotype.Component;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostUpdate;
import jakarta.persistence.PostRemove;
import lombok.RequiredArgsConstructor;

/** Time-driven booking/payment changes must wake clients even without an HTTP write. */
@Component
@RequiredArgsConstructor
public class RealtimeEntityListener {
    private final RealtimeUpdates updates;
    @PostPersist @PostUpdate @PostRemove
    public void changed(Object entity) { updates.changed(null); }
}
