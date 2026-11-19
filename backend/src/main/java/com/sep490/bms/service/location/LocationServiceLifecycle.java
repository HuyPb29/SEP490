package com.sep490.bms.service.location;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.location.ServiceTerm;
import com.sep490.bms.entity.notification.NotificationType;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.location.ServiceTermRepository;
import com.sep490.bms.service.notification.NotificationService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LocationServiceLifecycle {

    private static final int RENEWAL_REMINDER_DAYS = 3;
    private static final int OVERDUE_WARNING_DAYS = 5;
    private static final int AUTO_LOCK_DAYS = 10;

    private final LocationRepository locations;
    private final ServiceTermRepository terms;
    private final AccountRepository accounts;
    private final BookingRepository bookings;
    private final NotificationService notifications;

    @Transactional
    public void checkTerm(Long locationId, LocalDateTime now) {
        Location location = locations.findByIdForUpdate(locationId).orElse(null);
        if (location == null || !"ACTIVE".equals(location.getStatus())) {
            return;
        }
        ServiceTerm term = terms.findFirstByLocationIdOrderByEndDateDescIdDesc(locationId).orElse(null);
        if (term == null) {
            return;
        }
        long daysOverdue = ChronoUnit.DAYS.between(term.getEndDate(), now.toLocalDate());
        if (daysOverdue >= AUTO_LOCK_DAYS) {
            lock(location, now);
            notifyTerm(location.getOwnerId(), term, NotificationType.SERVICE_TERM_EXPIRED,
                    "Địa điểm đã bị khóa", location.getName() + " đã quá hạn gia hạn dịch vụ.");
        } else if (daysOverdue >= OVERDUE_WARNING_DAYS) {
            LocalDate lockDate = term.getEndDate().plusDays(AUTO_LOCK_DAYS);
            String message = location.getName() + " sẽ bị khóa ngày " + lockDate + " nếu chưa gia hạn. (MSG105)";
            String title = "Địa điểm sắp bị khóa";
            notifyTerm(location.getOwnerId(), term, "SERVICE_TERM_OVERDUE", title, message);
            for (Account admin : accounts.findByRoleAndStatus(Role.ADMIN, AccountStatus.ACTIVE)) {
                notifyTerm(admin.getId(), term, "SERVICE_TERM_OVERDUE", title, message);
            }
        } else if (daysOverdue >= -RENEWAL_REMINDER_DAYS && daysOverdue <= 0) {
            notifyTerm(location.getOwnerId(), term, "SERVICE_TERM_RENEWAL_REMINDER", "Sắp hết kỳ hạn dịch vụ",
                    location.getName() + " hết hạn dịch vụ ngày " + term.getEndDate() + ". (MSG104)");
        }
    }

    // Both callers hold the location row lock in their transaction.
    void lock(Location location, LocalDateTime now) {
        location.setStatus("LOCKED");
        location.setLockedAt(now);
        location.setUpdatedAt(now);
        int minute = now.getHour() * 60 + now.getMinute();
        if (now.getSecond() != 0 || now.getNano() != 0) {
            minute++;
        }
        String message = location.getName() + " đã bị khóa. Bạn còn buổi chưa chơi trong gói đặt sân. "
                + "Vui lòng liên hệ địa điểm qua số " + location.getContactPhone() + ". (MSG101)";
        for (Long playerId : bookings.findPlayersWithUnplayedPackageSessions(
                location.getId(), now.toLocalDate(), minute)) {
            notifications.notify(playerId, "LOCATION_LOCKED", "Địa điểm đã bị khóa", message,
                    "LOCATION", location.getId());
        }
    }

    private void notifyTerm(Long recipientId, ServiceTerm term, String type, String title, String message) {
        notifications.notifyOnce(recipientId, type, title, message, "SERVICE_TERM", term.getId());
    }
}
