package com.sep490.bms.scheduler;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.entity.enums.ComplaintStatus;
import com.sep490.bms.entity.feedback.Complaint;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.notification.NotificationType;
import com.sep490.bms.repository.feedback.ComplaintRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.service.booking.SlotAvailabilityService;
import com.sep490.bms.service.notification.NotificationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Feature: UC37 - Automated tasks and notifications (time-based automatic updates)
 * Job P33: khiếu nại chờ Owner quá 3 giờ tính trong giờ mở cửa thì báo gấp Owner (MSG111).
 *
 * Mốc tính là lúc khiếu nại đến tay Owner (forwarded_at); dữ liệu cũ chưa có cột này
 * thì lấy created_at. Mỗi khiếu nại chỉ báo một lần (notifyOnce theo recipient + type + ref).
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class ComplaintOverdueJob {

    private final ComplaintRepository complaintRepository;
    private final LocationRepository locationRepository;
    private final SlotAvailabilityService availability;
    private final NotificationService notificationService;

    @Scheduled(cron = "${bms.job.complaint.cron:0 */10 * * * *}")
    @Transactional
    public void warnOverdueComplaints() {
        LocalDateTime now = LocalDateTime.now();
        List<Complaint> pending = complaintRepository.findByStatus(ComplaintStatus.PENDING_OWNER);
        int warned = 0;
        for (Complaint complaint : pending) {
            LocalDateTime since = complaint.getForwardedAt() != null
                    ? complaint.getForwardedAt() : complaint.getCreatedAt();
            if (!availability.exceededOpeningTime(complaint.getLocationId(), since, now,
                    Complaint.OWNER_RESOLUTION_WAIT)) {
                continue;
            }
            Location location = locationRepository.findById(complaint.getLocationId()).orElse(null);
            if (location == null || location.getOwnerId() == null) {
                continue;
            }
            boolean sent = notificationService.notifyOnce(
                    location.getOwnerId(),
                    NotificationType.COMPLAINT_OVERDUE,
                    "Khiếu nại quá hạn xử lý",
                    "Khiếu nại #" + complaint.getId() + " tại địa điểm \"" + location.getName()
                            + "\" đã chờ quá " + Complaint.OWNER_RESOLUTION_WAIT.toHours()
                            + " giờ trong giờ mở cửa. Vui lòng xử lý gấp (MSG111).",
                    "COMPLAINT",
                    complaint.getId());
            if (sent) {
                warned++;
            }
        }
        if (warned > 0) {
            log.info("[UC37] Báo gấp Owner {} khiếu nại quá hạn P33", warned);
        }
    }
}
