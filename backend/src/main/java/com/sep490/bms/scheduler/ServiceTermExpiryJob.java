package com.sep490.bms.scheduler;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.notification.NotificationType;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.location.ServiceTermRepository;
import com.sep490.bms.service.notification.NotificationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Feature: UC37 - Automated tasks and notifications (time-based automatic updates)
 * Job 3: địa điểm hết kỳ hạn dịch vụ thì bị khoá và báo cho chủ địa điểm.
 *
 * Trước đây kỳ hạn chỉ để hiển thị: quá end_date mà địa điểm vẫn ACTIVE và vẫn bán sân.
 * Chỉ xét kỳ hạn XA NHẤT của mỗi địa điểm, vì owner có thể đã gia hạn thêm kỳ mới.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class ServiceTermExpiryJob {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_LOCKED = "LOCKED";

    private final ServiceTermRepository serviceTermRepository;
    private final LocationRepository locationRepository;
    private final NotificationService notificationService;

    @Scheduled(cron = "${bms.job.service-term.cron:0 5 0 * * *}")
    @Transactional
    public void lockLocationsWithExpiredTerm() {
        LocalDate today = LocalDate.now();
        List<ServiceTermRepository.LatestTermEnd> latest =
                serviceTermRepository.findLatestEndDateByLocation();
        int locked = 0;

        for (ServiceTermRepository.LatestTermEnd row : latest) {
            LocalDate termEnd = row.getMaxEndDate();
            if (termEnd == null || !termEnd.isBefore(today)) {
                continue;
            }
            Location location = locationRepository.findById(row.getLocationId()).orElse(null);
            if (location == null || !STATUS_ACTIVE.equals(location.getStatus())) {
                continue;
            }
            location.setStatus(STATUS_LOCKED);
            location.setLockedAt(LocalDateTime.now());
            locationRepository.save(location);
            notificationService.notifyOnce(
                    location.getOwnerId(),
                    NotificationType.SERVICE_TERM_EXPIRED,
                    "Kỳ hạn dịch vụ đã hết",
                    "Địa điểm \"" + location.getName() + "\" đã hết kỳ hạn dịch vụ từ ngày "
                            + termEnd + " nên đang bị tạm khoá. Gia hạn kỳ hạn mới để tiếp tục bán sân.",
                    "LOCATION",
                    location.getId());
            locked++;
        }

        if (locked > 0) {
            log.info("[UC37] Khoá {} địa điểm vì hết kỳ hạn dịch vụ", locked);
        }
    }
}
