package com.sep490.bms.scheduler;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.service.booking.BookingService;
import com.sep490.bms.service.notification.NotificationService;
import com.sep490.bms.service.promotion.LoyaltyPointService;
import com.sep490.bms.service.promotion.VoucherService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BookingHoldExpiryJobTests {
    @Mock BookingRepository repository;
    @Mock NotificationService notifications;
    @Mock BookingService bookings;
    @Mock VoucherService vouchers;
    @Mock LoyaltyPointService points;
    @Mock EntityManager entityManager;
    @InjectMocks BookingHoldExpiryJob job;

    private Booking expiredHold() {
        return Booking.builder().id(11L).playerId(22L).bookingCode("HOLD11")
                .playDate(LocalDate.now().plusDays(1)).startMinute(600).endMinute(660)
                .status(BookingStatus.HOLDING).holdExpiresAt(LocalDateTime.now().minusMinutes(1)).build();
    }

    @Test void expiryReleasesSlotsAndReturnsVoucherAndPoints() {
        Booking hold = expiredHold();
        when(repository.findAllByStatusAndHoldExpiresAtBefore(eq(BookingStatus.HOLDING), any()))
                .thenReturn(List.of(hold));
        job.expireExpiredHolds();
        var order = inOrder(entityManager, bookings, vouchers, points);
        order.verify(entityManager).refresh(hold, LockModeType.PESSIMISTIC_WRITE);
        order.verify(bookings).changeStatus(hold, BookingStatus.EXPIRED);
        order.verify(bookings).releaseSlots(11L);
        order.verify(vouchers).restoreForFailedBooking(11L);
        order.verify(points).restoreForFailedBooking(11L);
        verify(notifications).notifyOnce(eq(22L), any(), anyString(), anyString(), eq("BOOKING"), eq(11L));
    }

    @Test void proofSubmittedAfterScanMustNotExpireOrReturnDiscounts() {
        Booking hold = expiredHold();
        when(repository.findAllByStatusAndHoldExpiresAtBefore(eq(BookingStatus.HOLDING), any()))
                .thenReturn(List.of(hold));
        doAnswer(call -> { hold.setStatus(BookingStatus.AWAITING_CONFIRMATION); return null; })
                .when(entityManager).refresh(hold, LockModeType.PESSIMISTIC_WRITE);
        job.expireExpiredHolds();
        verifyNoInteractions(bookings, vouchers, points, notifications);
    }

    @Test void holdExtendedAfterScanMustNotBeReleased() {
        Booking hold = expiredHold();
        when(repository.findAllByStatusAndHoldExpiresAtBefore(eq(BookingStatus.HOLDING), any()))
                .thenReturn(List.of(hold));
        doAnswer(call -> { hold.setHoldExpiresAt(LocalDateTime.now().plusMinutes(5)); return null; })
                .when(entityManager).refresh(hold, LockModeType.PESSIMISTIC_WRITE);
        job.expireExpiredHolds();
        verifyNoInteractions(bookings, vouchers, points, notifications);
    }
}
