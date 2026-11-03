package com.sep490.bms.scheduler;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.notification.NotificationType;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.service.notification.NotificationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Feature: UC37 - Automated tasks and notifications (time-based automatic updates)
 * Job 1: đơn còn HOLDING mà quá hold_expires_at thì chuyển EXPIRED và báo cho khách.
 *
 * Trước đây không có job nào quét hold_expires_at, nên đơn giữ chỗ khách bỏ ngang sẽ
 * treo slot vĩnh viễn: slot vẫn bị coi là đã đặt dù chưa ai thanh toán.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class BookingHoldExpiryJob {

    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;

    @Scheduled(
            initialDelayString = "${bms.job.booking-hold.initial-delay-ms:30000}",
            fixedDelayString = "${bms.job.booking-hold.interval-ms:60000}")
    @Transactional
    public void expireExpiredHolds() {
        LocalDateTime now = LocalDateTime.now();
        List<Booking> holds =
                bookingRepository.findAllByStatusAndHoldExpiresAtBefore(BookingStatus.HOLDING, now);
        if (holds.isEmpty()) {
            return;
        }
        for (Booking booking : holds) {
            booking.setStatus(BookingStatus.EXPIRED);
            booking.setUpdatedAt(now);
            bookingRepository.save(booking);
            if (booking.getPlayerId() != null) {
                notificationService.notifyOnce(
                        booking.getPlayerId(),
                        NotificationType.BOOKING_HOLD_EXPIRED,
                        "Đơn giữ chỗ đã hết hạn",
                        "Đơn " + booking.getBookingCode() + " ngày " + booking.getPlayDate()
                                + " (" + formatMinute(booking.getStartMinute()) + " - "
                                + formatMinute(booking.getEndMinute())
                                + ") đã bị huỷ vì quá hạn thanh toán.",
                        "BOOKING",
                        booking.getId());
            }
        }
        log.info("[UC37] Huỷ {} đơn giữ chỗ quá hạn thanh toán", holds.size());
    }

    /** start_minute/end_minute là số phút tính từ 00:00, 1440 hiển thị là 24:00. */
    private String formatMinute(int minute) {
        return String.format("%02d:%02d", minute / 60, minute % 60);
    }
}
