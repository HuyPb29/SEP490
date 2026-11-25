package com.sep490.bms.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.notification.NotificationType;
import com.sep490.bms.entity.notification.Notification;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.notification.NotificationRepository;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.service.booking.SlotAvailabilityService;
import com.sep490.bms.service.notification.NotificationService;
import com.sep490.bms.service.payment.PaymentTransferPolicy;

/** UC37 #7, FR120, BR58 (D182): chuyển giao dịch chờ quá P24 + P36 (25 phút) cho chủ sân, báo Owner (MSG119) và Staff (MSG118). */
class PaymentTransferJobTests {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 20, 18, 0);
    private static final LocalDateTime SUBMITTED = NOW.minusMinutes(30);

    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final LocationRepository locations = mock(LocationRepository.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final NotificationRepository notificationRepository = mock(NotificationRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final SlotAvailabilityService availability = mock(SlotAvailabilityService.class);
    private final BookingRepository bookings = mock(BookingRepository.class);
    private final PaymentTransferPolicy policy = new PaymentTransferPolicy(availability);
    private final PaymentTransferJob job = new PaymentTransferJob(payments, policy, locations, bookings, accounts, notifications);

    private final Payment payment = Payment.builder().id(50L).locationId(2L).bookingId(30L)
            .amountDue(new BigDecimal("110000")).status(PaymentStatus.AWAITING_CONFIRMATION).submittedAt(SUBMITTED).build();

    @BeforeEach
    void setUp() {
        when(payments.findByStatusAndSubmittedAtBefore(PaymentStatus.AWAITING_CONFIRMATION, NOW.minusMinutes(25)))
                .thenReturn(List.of(payment));
        when(locations.findById(2L)).thenReturn(Optional.of(Location.builder().id(2L).ownerId(8L).name("Sân Cầu Giấy").build()));
        when(bookings.findById(30L)).thenReturn(Optional.of(Booking.builder().id(30L).bookingCode("BK000030").build()));
        Account active = Account.builder().id(5L).role(Role.STAFF).status(AccountStatus.ACTIVE).build();
        Account locked = Account.builder().id(6L).role(Role.STAFF).status(AccountStatus.LOCKED).build();
        when(accounts.findByRoleAndLocationId(Role.STAFF, 2L)).thenReturn(List.of(active, locked));
    }

    @Test
    void paymentWaitingPastP24PlusP36InOpeningHoursIsHandedToOwner() {
        when(availability.exceededOpeningTime(2L, SUBMITTED, NOW, Payment.OWNER_TRANSFER_WAIT)).thenReturn(true);

        job.notifyTransferredPayments(NOW);

        verify(notifications).notifyOnce(eq(8L), eq(NotificationType.PAYMENT_TRANSFERRED_TO_OWNER), anyString(),
                eq("Giao dịch BK000030 tại Sân Cầu Giấy đã chờ quá 25 phút mà nhân viên chưa xác nhận. "
                        + "Vui lòng kiểm tra tiền về và xử lý. (MSG119)"),
                eq("PAYMENT"), eq(50L));
        verify(notifications).notifyOnce(eq(5L), eq(NotificationType.PAYMENT_TRANSFERRED_TO_OWNER), anyString(),
                eq("Giao dịch BK000030 đã chờ quá 25 phút mà chưa được xác nhận nên đã được chuyển cho chủ sân xử lý. (MSG118)"),
                eq("PAYMENT"), eq(50L));
        verify(notifications, never()).notifyOnce(eq(6L), anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void waitOutsideOpeningHoursDoesNotCount() {
        when(availability.exceededOpeningTime(2L, SUBMITTED, NOW, Payment.OWNER_TRANSFER_WAIT)).thenReturn(false);

        job.notifyTransferredPayments(NOW);

        verify(notifications, never()).notifyOnce(anyLong(), anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void repeatedRunNotifiesEachRecipientOnlyOnce() {
        when(availability.exceededOpeningTime(2L, SUBMITTED, NOW, Payment.OWNER_TRANSFER_WAIT)).thenReturn(true);
        for (long recipient : List.of(8L, 5L)) {
            when(notificationRepository.existsByRecipientIdAndTypeAndRefTypeAndRefId(recipient,
                    NotificationType.PAYMENT_TRANSFERRED_TO_OWNER, "PAYMENT", 50L)).thenReturn(false, true);
        }
        var jobWithDeduplication = new PaymentTransferJob(payments, policy, locations, bookings, accounts,
                new NotificationService(notificationRepository));

        jobWithDeduplication.notifyTransferredPayments(NOW);
        jobWithDeduplication.notifyTransferredPayments(NOW);

        var saved = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(Notification::getRecipientId).containsExactly(8L, 5L);
    }
}
