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
 * Job 4: voucher PUBLISHED đã quá valid_to thì chuyển sang EXPIRED và báo chủ địa điểm.
 *
 * Chỉ xét voucher đang PUBLISHED. Voucher DRAFT quá hạn không bị đổi trạng thái vì
 * DRAFT còn đang soạn, và publish() đã tự chặn ngày hết hạn nên không thể phát hành
 * một voucher đã chết.
 *
 * valid_to để trống nghĩa là không giới hạn, nên điều kiện lessThan tự loại các dòng đó.
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

        int expiredCount = 0;
        for (Voucher voucher : vouchers) {
            voucher.setStatus(VoucherStatus.EXPIRED);
            voucherRepository.save(voucher);
            expiredCount++;

            Location location = locationRepository.findById(voucher.getLocationId()).orElse(null);
            if (location == null || location.getOwnerId() == null) {
                continue;
            }
            notificationService.notifyOnce(
                    location.getOwnerId(),
                    NotificationType.VOUCHER_EXPIRED,
                    "Voucher đã hết hiệu lực",
                    "Voucher \"" + voucher.getName() + "\" của địa điểm \"" + location.getName()
                            + "\" đã hết hiệu lực từ ngày " + voucher.getValidTo()
                            + " nên được chuyển sang trạng thái EXPIRED. Cập nhật lại ngày hiệu lực"
                            + " nếu muốn tiếp tục sử dụng.",
                    "VOUCHER",
                    voucher.getId());
        }

        log.info("[UC37] Đã chuyển {} voucher hết hiệu lực sang EXPIRED", expiredCount);
    }
}
