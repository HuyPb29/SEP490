package com.sep490.bms.controller.notification;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.notification.RealtimeUpdates;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class RealtimeController {
    private final RealtimeUpdates updates;

    @GetMapping(value = "/api/realtime/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> events(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .header("X-Accel-Buffering", "no").body(updates.subscribe(user.getId()));
    }
}
