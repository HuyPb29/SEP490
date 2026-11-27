package com.sep490.bms.service.location;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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

/**
 * Unit test thuần Mockito cho LocationServiceLifecycle (UC37, P30/P31/P32, D123).
 */
@ExtendWith(MockitoExtension.class)
class LocationServiceLifecycleUnitTests {

    private static final Long LOCATION_ID = 1L;
    private static final Long OWNER_ID = 10L;
    private static final Long TERM_ID = 20L;
    private static final LocalDate END_DATE = LocalDate.of(2026, 12, 10);

    @Mock
    private LocationRepository locations;

    @Mock
    private ServiceTermRepository terms;

    @Mock
    private AccountRepository accounts;

    @Mock
    private BookingRepository bookings;

    @Mock
    private NotificationService notifications;

    @InjectMocks
    private LocationServiceLifecycle lifecycle;

    private static Location activeLocation() {
        return Location.builder()
                .id(LOCATION_ID)
                .ownerId(OWNER_ID)
                .name("Sân A")
                .contactPhone("0988777666")
                .status("ACTIVE")
                .build();
    }

    private static ServiceTerm latestTerm() {
        return ServiceTerm.builder()
                .id(TERM_ID)
                .locationId(LOCATION_ID)
                .endDate(END_DATE)
                .build();
    }

    // Kiểm tra biên đúng 3 ngày trước ngày hết hạn (P30): gửi thông báo nhắc gia hạn MSG104 và giữ địa điểm ACTIVE.
    @Test
    void checkTerm_threeDaysBeforeExpiry_notifiesOwnerWithoutLocking() {
        // Arrange
        Location location = activeLocation();
        LocalDateTime now = LocalDateTime.of(2026, 12, 7, 0, 5);
        when(locations.findByIdForUpdate(LOCATION_ID)).thenReturn(Optional.of(location));
        when(terms.findFirstByLocationIdOrderByEndDateDescIdDesc(LOCATION_ID)).thenReturn(Optional.of(latestTerm()));

        // Act
        lifecycle.checkTerm(LOCATION_ID, now);

        // Assert
        assertThat(location.getStatus()).isEqualTo("ACTIVE");
        verify(notifications).notifyOnce(
                OWNER_ID,
                "SERVICE_TERM_RENEWAL_REMINDER",
                "Sắp hết kỳ hạn dịch vụ",
                "Sân A hết hạn dịch vụ ngày 2026-12-10. (MSG104)",
                "SERVICE_TERM",
                TERM_ID);
        verifyNoMoreInteractions(notifications);
        verifyNoInteractions(accounts, bookings);
    }

    // Kiểm tra biên ngày quá hạn thứ 4 (giữa mốc nhắc -3..0 và cảnh báo >=5): chưa gửi thông báo và chưa khóa.
    @Test
    void checkTerm_fourDaysOverdue_neitherNotifiesNorLocks() {
        // Arrange
        Location location = activeLocation();
        LocalDateTime now = LocalDateTime.of(2026, 12, 14, 0, 5);
        when(locations.findByIdForUpdate(LOCATION_ID)).thenReturn(Optional.of(location));
        when(terms.findFirstByLocationIdOrderByEndDateDescIdDesc(LOCATION_ID)).thenReturn(Optional.of(latestTerm()));

        // Act
        lifecycle.checkTerm(LOCATION_ID, now);

        // Assert
        assertThat(location.getStatus()).isEqualTo("ACTIVE");
        verifyNoInteractions(notifications, accounts, bookings);
    }

    // Kiểm tra khoảng quá hạn 5-9 ngày (P32): gửi cảnh báo sắp khóa MSG105 cho Owner và toàn bộ Admin đang ACTIVE.
    @Test
    void checkTerm_sevenDaysOverdue_warnsOwnerAndAllActiveAdmins() {
        // Arrange
        Location location = activeLocation();
        LocalDateTime now = LocalDateTime.of(2026, 12, 17, 0, 5);
        Account admin1 = Account.builder().id(101L).role(Role.ADMIN).status(AccountStatus.ACTIVE).build();
        Account admin2 = Account.builder().id(102L).role(Role.ADMIN).status(AccountStatus.ACTIVE).build();
        when(locations.findByIdForUpdate(LOCATION_ID)).thenReturn(Optional.of(location));
        when(terms.findFirstByLocationIdOrderByEndDateDescIdDesc(LOCATION_ID)).thenReturn(Optional.of(latestTerm()));
        when(accounts.findByRoleAndStatus(Role.ADMIN, AccountStatus.ACTIVE)).thenReturn(List.of(admin1, admin2));

        // Act
        lifecycle.checkTerm(LOCATION_ID, now);

        // Assert
        assertThat(location.getStatus()).isEqualTo("ACTIVE");
        String expectedMessage = "Sân A sẽ bị khóa ngày 2026-12-20 nếu chưa gia hạn. (MSG105)";
        verify(notifications).notifyOnce(OWNER_ID, "SERVICE_TERM_OVERDUE", "Địa điểm sắp bị khóa",
                expectedMessage, "SERVICE_TERM", TERM_ID);
        verify(notifications).notifyOnce(101L, "SERVICE_TERM_OVERDUE", "Địa điểm sắp bị khóa",
                expectedMessage, "SERVICE_TERM", TERM_ID);
        verify(notifications).notifyOnce(102L, "SERVICE_TERM_OVERDUE", "Địa điểm sắp bị khóa",
                expectedMessage, "SERVICE_TERM", TERM_ID);
        verifyNoMoreInteractions(notifications);
        verifyNoInteractions(bookings);
    }

    // Kiểm tra biên đúng 10 ngày quá hạn (P31) có giây lẻ (10:00:01 -> phút 601): khóa địa điểm và báo Player còn buổi gói (MSG101).
    @Test
    void checkTerm_tenDaysOverdueWithOddSecond_locksRoundsMinuteUpAndNotifiesAffectedPlayers() {
        // Arrange
        Location location = activeLocation();
        LocalDateTime now = LocalDateTime.of(2026, 12, 20, 10, 0, 1);
        when(locations.findByIdForUpdate(LOCATION_ID)).thenReturn(Optional.of(location));
        when(terms.findFirstByLocationIdOrderByEndDateDescIdDesc(LOCATION_ID)).thenReturn(Optional.of(latestTerm()));
        when(bookings.findPlayersWithUnplayedPackageSessions(LOCATION_ID, LocalDate.of(2026, 12, 20), 601))
                .thenReturn(List.of(501L, 502L));

        // Act
        lifecycle.checkTerm(LOCATION_ID, now);

        // Assert
        assertThat(location.getStatus()).isEqualTo("LOCKED");
        assertThat(location.getLockedAt()).isEqualTo(now);
        assertThat(location.getUpdatedAt()).isEqualTo(now);
        verify(bookings).findPlayersWithUnplayedPackageSessions(LOCATION_ID, LocalDate.of(2026, 12, 20), 601);
        verify(notifications).notify(eq(501L), eq("LOCATION_LOCKED"), eq("Địa điểm đã bị khóa"),
                contains("MSG101"), eq("LOCATION"), eq(LOCATION_ID));
        verify(notifications).notify(eq(502L), eq("LOCATION_LOCKED"), eq("Địa điểm đã bị khóa"),
                contains("0988777666"), eq("LOCATION"), eq(LOCATION_ID));
        verify(notifications).notifyOnce(
                OWNER_ID,
                NotificationType.SERVICE_TERM_EXPIRED,
                "Địa điểm đã bị khóa",
                "Sân A đã quá hạn gia hạn dịch vụ.",
                "SERVICE_TERM",
                TERM_ID);
    }

    // Kiểm tra quá hạn trên 10 ngày lúc tròn phút (10:00:00 -> phút 600) và không còn buổi gói chưa chơi: chỉ khóa và báo Owner.
    @Test
    void checkTerm_twelveDaysOverdueAtExactMinute_locksWithoutPlayerNotificationsWhenNoUnplayedSessions() {
        // Arrange
        Location location = activeLocation();
        LocalDateTime now = LocalDateTime.of(2026, 12, 22, 10, 0, 0);
        when(locations.findByIdForUpdate(LOCATION_ID)).thenReturn(Optional.of(location));
        when(terms.findFirstByLocationIdOrderByEndDateDescIdDesc(LOCATION_ID)).thenReturn(Optional.of(latestTerm()));
        when(bookings.findPlayersWithUnplayedPackageSessions(LOCATION_ID, LocalDate.of(2026, 12, 22), 600))
                .thenReturn(List.of());

        // Act
        lifecycle.checkTerm(LOCATION_ID, now);

        // Assert
        assertThat(location.getStatus()).isEqualTo("LOCKED");
        verify(notifications, never()).notify(any(), any(), any(), any(), any(), any());
        verify(notifications).notifyOnce(
                OWNER_ID,
                NotificationType.SERVICE_TERM_EXPIRED,
                "Địa điểm đã bị khóa",
                "Sân A đã quá hạn gia hạn dịch vụ.",
                "SERVICE_TERM",
                TERM_ID);
    }

    // Kiểm tra bỏ qua an toàn khi địa điểm đã ở trạng thái LOCKED, không truy vấn thêm hay gửi trùng thông báo.
    @Test
    void checkTerm_alreadyLockedLocation_returnsEarlyWithoutTouchingDependencies() {
        // Arrange
        Location locked = Location.builder().id(LOCATION_ID).ownerId(OWNER_ID).status("LOCKED").build();
        LocalDateTime now = LocalDateTime.of(2026, 12, 22, 10, 0, 0);
        when(locations.findByIdForUpdate(LOCATION_ID)).thenReturn(Optional.of(locked));

        // Act
        lifecycle.checkTerm(LOCATION_ID, now);

        // Assert
        assertThat(locked.getStatus()).isEqualTo("LOCKED");
        verifyNoInteractions(terms, accounts, bookings, notifications);
    }

    // Kiểm tra ngoại lệ dữ liệu: địa điểm ACTIVE nhưng chưa có kỳ hạn nào thì thoát sớm, không khóa hay báo lỗi.
    @Test
    void checkTerm_activeLocationWithoutServiceTerm_returnsEarlyWithoutLockingOrNotifying() {
        // Arrange
        Location location = activeLocation();
        LocalDateTime now = LocalDateTime.of(2026, 12, 22, 10, 0, 0);
        when(locations.findByIdForUpdate(LOCATION_ID)).thenReturn(Optional.of(location));
        when(terms.findFirstByLocationIdOrderByEndDateDescIdDesc(LOCATION_ID)).thenReturn(Optional.empty());

        // Act
        lifecycle.checkTerm(LOCATION_ID, now);

        // Assert
        assertThat(location.getStatus()).isEqualTo("ACTIVE");
        verifyNoInteractions(accounts, bookings, notifications);
    }
}
