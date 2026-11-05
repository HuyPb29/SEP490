package com.sep490.bms.scheduler;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.repository.booking.BookingRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Feature: UC37 - Automated tasks and notifications (time-based automatic updates)
 * Job 2: chuyển trạng thái đơn theo giờ chơi.
 *
 * CONFIRMED -> IN_USE khi đã tới play_date + start_minute; IN_USE -> COMPLETED khi
 * đã qua play_date + end_minute. Nếu job bị dừng lâu, đơn CONFIRMED đã qua cả giờ
 * kết thúc sẽ được đưa thẳng sang COMPLETED thay vì kẹt ở IN_USE.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class BookingStatusJob {

    private final BookingRepository bookingRepository;

    @Scheduled(
            initialDelayString = "${bms.job.booking-status.initial-delay-ms:35000}",
            fixedDelayString = "${bms.job.booking-status.interval-ms:60000}")
    @Transactional
    public void advanceBookingStatus() {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();
        LocalTime time = now.toLocalTime();
        int minute = time.getHour() * 60 + time.getMinute();

        List<Booking> toComplete = bookingRepository.findReachedEnd(BookingStatus.IN_USE, today, minute);
        for (Booking booking : toComplete) {
            booking.setStatus(BookingStatus.COMPLETED);
            booking.setUpdatedAt(now);
            bookingRepository.save(booking);
        }

        List<Booking> toStart = bookingRepository.findReachedStart(BookingStatus.CONFIRMED, today, minute);
        int started = 0;
        for (Booking booking : toStart) {
            boolean alreadyEnded = booking.getPlayDate().isBefore(today)
                    || (booking.getPlayDate().isEqual(today) && booking.getEndMinute() <= minute);
            booking.setStatus(alreadyEnded ? BookingStatus.COMPLETED : BookingStatus.IN_USE);
            booking.setUpdatedAt(now);
            bookingRepository.save(booking);
            started++;
        }

        if (!toComplete.isEmpty() || started > 0) {
            log.info("[UC37] Đơn hoàn tất: {}, đơn chuyển sang đang chơi: {}", toComplete.size(), started);
        }
    }
}
