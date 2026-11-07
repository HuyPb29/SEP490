package com.sep490.bms.scheduler;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sep490.bms.service.team.MatchService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Feature: F7 – Đội và kèo
 * Owner: Hoàng
 * Định kỳ đóng kèo tới giờ chơi và cho hết hạn kèo có booking bị hủy (UC37, JOB10, FR101).
 * Tắt bằng bms.scheduler.match-sweep.enabled=false.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "bms.scheduler.match-sweep.enabled", havingValue = "true", matchIfMissing = true)
public class MatchStatusScheduler {

    private final MatchService matchService;

    @Scheduled(initialDelayString = "${bms.scheduler.match-sweep.initial-delay-ms:60000}",
            fixedDelayString = "${bms.scheduler.match-sweep.delay-ms:300000}")
    public void sweepEndedMatches() {
        try {
            int changed = matchService.sweepEndedMatches();
            if (changed > 0) {
                log.info("Đã cập nhật trạng thái {} kèo đã kết thúc", changed);
            }
        } catch (RuntimeException e) {
            log.error("Không cập nhật được trạng thái kèo", e);
        }
    }
}
