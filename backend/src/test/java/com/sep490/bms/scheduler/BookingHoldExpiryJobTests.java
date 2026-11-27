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
import com.sep490.bms.service.location.LocationQueryService;
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

/**
 * Kiểm tra hết hạn giữ chỗ, trả ưu đãi và đọc lại trạng thái trước khi giải phóng slot.
 */
@ExtendWith(MockitoExtension.class)
class BookingHoldExpiryJobTests {
    @Mock BookingRepository repository;
    @Mock NotificationService notifications;
    @Mock BookingService bookings;
    @Mock VoucherService vouchers;
    @Mock LoyaltyPointService points;
    @Mock EntityManager entityManager;
    @Mock LocationQueryService locations;
    @InjectMocks BookingHoldExpiryJob job;

    private Booking expiredHold() {
        return Booking.builder().id(11L).locationId(1L).playerId(22L).bookingCode("HOLD11")
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

    private Booking hold(long id, long location) {
        return Booking.builder().id(id).locationId(location).status(BookingStatus.HOLDING)
                .holdExpiresAt(LocalDateTime.now().minusMinutes(1)).build();
    }

    @Test
    void locksAllVenuesInOrderBeforeAnyBookingAndSkipsPackageChildren() {
        Booking secondVenue = hold(1, 2), firstVenue = hold(2, 1), child = hold(3, 3);
        child.setPackageId(9L);
        when(repository.findAllByStatusAndHoldExpiresAtBefore(eq(BookingStatus.HOLDING), any()))
                .thenReturn(List.of(secondVenue, child, firstVenue));
        job.expireExpiredHolds();
        var order = inOrder(locations, entityManager, bookings, vouchers, points);
        order.verify(locations).findForUpdate(1L);
        order.verify(locations).findForUpdate(2L);
        order.verify(entityManager).refresh(secondVenue, LockModeType.PESSIMISTIC_WRITE);
        order.verify(bookings).changeStatus(secondVenue, BookingStatus.EXPIRED);
        order.verify(vouchers).restoreForFailedBooking(1L);
        order.verify(points).restoreForFailedBooking(1L);
        verify(locations, never()).findForUpdate(3L);
        verify(entityManager, never()).refresh(child, LockModeType.PESSIMISTIC_WRITE);
        verify(bookings).changeStatus(firstVenue, BookingStatus.EXPIRED);
    }

    @Test
    void rechecksAfterVenueWaitAndDoesNotOverwriteCourtCancellation() {
        Booking booking = hold(1, 1);
        when(repository.findAllByStatusAndHoldExpiresAtBefore(eq(BookingStatus.HOLDING), any()))
                .thenReturn(List.of(booking));
        when(locations.findForUpdate(1L)).thenAnswer(call -> {
            booking.setStatus(BookingStatus.CANCELLED_BY_FACILITY);
            return null;
        });
        job.expireExpiredHolds();
        verify(entityManager).refresh(booking, LockModeType.PESSIMISTIC_WRITE);
        verifyNoInteractions(bookings, vouchers, points);
    }
}
