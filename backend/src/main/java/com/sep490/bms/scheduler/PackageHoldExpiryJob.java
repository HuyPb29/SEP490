package com.sep490.bms.scheduler;

import java.time.LocalDateTime;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sep490.bms.entity.booking.BookingPackage;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.repository.booking.BookingPackageRepository;
import com.sep490.bms.service.booking.PackageService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * UC37, BR53: gói đặt nhiều buổi còn Đang giữ chỗ quá 15 phút (P27) thì hết hạn, nhả slot, trả voucher và điểm.
 * BookingHoldExpiryJob chỉ xử lý booking lẻ (bỏ qua buổi trong gói), vì gói hết hạn theo cả gói.
 * Dùng chung lịch chạy với BookingHoldExpiryJob. Mỗi gói một giao dịch: một gói lỗi không làm hỏng các gói khác.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class PackageHoldExpiryJob {

    private final BookingPackageRepository bookingPackageRepository;
    private final PackageService packageService;

    @Scheduled(
            initialDelayString = "${bms.job.booking-hold.initial-delay-ms:30000}",
            fixedDelayString = "${bms.job.booking-hold.interval-ms:60000}")
    public void expireExpiredPackageHolds() {
        LocalDateTime now = LocalDateTime.now();
        int expired = 0;
        for (BookingPackage pkg : bookingPackageRepository.findAllByStatusAndHoldExpiresAtBefore(BookingStatus.HOLDING, now)) {
            try {
                if (packageService.expireHold(pkg.getId(), now)) {
                    expired++;
                }
            } catch (RuntimeException e) {
                log.error("[UC37] Không hủy được gói giữ chỗ quá hạn {}", pkg.getId(), e);
            }
        }
        if (expired > 0) {
            log.info("[UC37] Huỷ {} gói giữ chỗ quá hạn thanh toán", expired);
        }
    }
}
