package com.sep490.bms.scheduler;

import java.time.LocalDate;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.notification.NotificationType;
import com.sep490.bms.entity.promotion.Voucher;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.promotion.VoucherRepository;
import com.sep490.bms.service.notification.NotificationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Feature: UC37 - Automated tasks and notifications (time-based automatic updates)
 * Job 4: voucher đã quá valid_to thì báo cho chủ địa điểm.
 *
 * Lưu ý thiết kế: bảng voucher chỉ có 3 trạng thái DRAFT / PUBLISHED / DISABLED
 * (ràng buộc ck_voucher_status), không có EXPIRED. Vì vậy job này KHÔNG đổi status
 * mà chỉ cảnh báo để owner chủ động tắt voucher; việc thêm trạng thái EXPIRED phải
 * sửa ràng buộc DB và enum của feature voucher nên cần thống nhất với nhóm.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class VoucherExpiryJob {

    private final VoucherRepository voucherRepository;
    private final LocationRepository locationRepository;
    private final NotificationService notificationService;

    @Scheduled(cron = "${bms.job.voucher.cron:0 10 0 * * *}")
    @Transactional
    public void warnExpiredVouchers() {
        LocalDate today = LocalDate.now();
        Specification<Voucher> expired = (root, query, cb) -> cb.and(
                cb.equal(root.get("status"), VoucherStatus.PUBLISHED),
                cb.lessThan(root.get("validTo").as(LocalDate.class), today));
        List<Voucher> vouchers = voucherRepository.findAll(expired);
        if (vouchers.isEmpty()) {
            return;
        }

        int notified = 0;
        for (Voucher voucher : vouchers) {
            Location location = locationRepository.findById(voucher.getLocationId()).orElse(null);
            if (location == null || location.getOwnerId() == null) {
                continue;
            }
            boolean created = notificationService.notifyOnce(
                    location.getOwnerId(),
                    NotificationType.VOUCHER_EXPIRED,
                    "Voucher đã hết hiệu lực",
                    "Voucher \"" + voucher.getName() + "\" của địa điểm \"" + location.getName()
                            + "\" đã hết hiệu lực từ ngày " + voucher.getValidTo()
                            + " nhưng vẫn đang ở trạng thái PUBLISHED.",
                    "VOUCHER",
                    voucher.getId());
            if (created) {
                notified++;
            }
        }

        if (notified > 0) {
            log.info("[UC37] Cảnh báo {} voucher đã hết hiệu lực", notified);
        }
    }
}
