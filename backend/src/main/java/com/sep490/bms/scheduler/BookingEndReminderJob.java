package com.sep490.bms.scheduler;

import java.time.LocalDateTime;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.notification.NotificationType;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.service.notification.NotificationService;

import lombok.RequiredArgsConstructor;

/** UC37 / FR119: nhắc Staff kiểm tra sân trước khi buổi chơi kết thúc. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class BookingEndReminderJob {

    private static final int REMINDER_MINUTES = 5;

    private final BookingRepository bookings;
    private final AccountRepository accounts;
    private final LocationRepository locations;
    private final NotificationService notifications;

    @Scheduled(cron = "${bms.job.booking-end.cron:*/5 * * * * *}")
    @Transactional
    public void remindStaff() {
        LocalDateTime now = LocalDateTime.now();
        int minute = now.getHour() * 60 + now.getMinute();
        for (Long id : bookings.findEndingSoonIds(now.toLocalDate(), minute, minute + REMINDER_MINUTES)) {
            var booking = bookings.findByIdForUpdate(id).orElse(null);
            if (booking == null || booking.getStatus() != BookingStatus.IN_USE
                    || !booking.getPlayDate().equals(now.toLocalDate())
                    || booking.getEndMinute() <= minute || booking.getEndMinute() > minute + REMINDER_MINUTES
                    || locations.findByIdAndStatus(booking.getLocationId(), "ACTIVE").isEmpty()) {
                continue;
            }
            String content = "Booking " + booking.getBookingCode() + " kết thúc lúc "
                    + MinuteTime.format(booking.getEndMinute()) + ". Vui lòng kiểm tra sân.";
            for (var staff : accounts.findByRoleAndLocationId(Role.STAFF, booking.getLocationId())) {
                if (staff.getStatus() == AccountStatus.ACTIVE) {
                    notifications.notifyOnce(staff.getId(), NotificationType.BOOKING_ENDING_SOON,
                            "Booking sắp hết giờ", content, "BOOKING", booking.getId());
                }
            }
        }
    }
}
