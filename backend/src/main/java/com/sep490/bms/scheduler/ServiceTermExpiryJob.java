package com.sep490.bms.scheduler;

import java.time.LocalDateTime;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sep490.bms.repository.location.ServiceTermRepository;
import com.sep490.bms.service.location.LocationServiceLifecycle;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class ServiceTermExpiryJob {

    private final ServiceTermRepository serviceTermRepository;
    private final LocationServiceLifecycle lifecycle;

    @Scheduled(cron = "${bms.job.service-term.cron:0 5 0 * * *}")
    public void lockLocationsWithExpiredTerm() {
        LocalDateTime now = LocalDateTime.now();
        for (ServiceTermRepository.LatestTermEnd term : serviceTermRepository.findLatestEndDateByLocation()) {
            if (term.getMaxEndDate().isAfter(now.toLocalDate().plusDays(3))) {
                continue;
            }
            try {
                lifecycle.checkTerm(term.getLocationId(), now);
            } catch (RuntimeException ex) {
                log.error("Không thể cập nhật kỳ hạn dịch vụ của địa điểm {}", term.getLocationId(), ex);
            }
        }
    }
}
