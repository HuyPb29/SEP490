package com.sep490.bms.service.reschedule;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.List;
import com.sep490.bms.entity.booking.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.service.booking.SlotAvailabilityService;
import com.sep490.bms.service.promotion.*;
import jakarta.persistence.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/** Kiểm tra đóng sân xử lý lịch chờ và đơn/gói, trả ưu đãi và không xử lý trùng. */
class CourtDisabledPendingTests {
    final EntityManager em = mock(EntityManager.class);
    final BookingChangeSupport support = mock(BookingChangeSupport.class);
    final LoyaltyPointService points = mock(LoyaltyPointService.class);
    final VoucherService vouchers = mock(VoucherService.class);
    final CancellationService service = new CancellationService(em, support, mock(RescheduleService.class),
            mock(LocationAccessService.class), points, vouchers, mock(SlotAvailabilityService.class));

    @SuppressWarnings("unchecked")
    void candidates(Booking booking) {
        TypedQuery<Booking> query = mock(TypedQuery.class, RETURNS_SELF);
        when(em.createQuery(anyString(), eq(Booking.class))).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of(booking));
        when(support.booking(booking.getId())).thenReturn(booking);
    }
    @ParameterizedTest
    @EnumSource(value=BookingStatus.class, names={"HOLDING", "AWAITING_CONFIRMATION", "RESUBMIT_REQUESTED"})
    void disablesUnconfirmedBookingReleasesSlotsAndRestoresBenefits(BookingStatus status) {
        Booking booking = Booking.builder().id(1L).courtId(5L).playerId(7L).status(status).build();
        candidates(booking);
        Payment payment = Payment.builder().id(10L).bookingId(1L).status(PaymentStatus.AWAITING_CONFIRMATION).build();
        when(support.basePayments(booking)).thenReturn(List.of(payment));
        service.courtDisabled(5L, 9L);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.CANCELLED_BY_FACILITY);
        assertThat(booking.getCancelledBy()).isEqualTo(9L);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REJECTED);
        verify(support).release(1L, null);
        verify(vouchers).restoreForFailedBooking(1L);
        verify(points).restoreForFailedBooking(1L);
        verify(support).notify(eq(7L), eq("BOOKING_CANCELLED"), anyString(), eq(1L));
        var order = inOrder(support);
        order.verify(support).lock(Payment.class, 10L);
        order.verify(support).booking(1L);
    }
    @Test @SuppressWarnings("unchecked")
    void pendingPackageCancelsEverySessionAndReturnsBenefitsAtPackageLevelOnce() {
        Booking first = Booking.builder().id(1L).courtId(5L).packageId(20L).status(BookingStatus.HOLDING).build();
        Booking second = Booking.builder().id(2L).courtId(6L).packageId(20L).status(BookingStatus.HOLDING).build();
        BookingPackage pkg = BookingPackage.builder().id(20L).status(BookingStatus.HOLDING).build();
        candidates(first);
        when(support.booking(2L)).thenReturn(second);
        when(support.lock(BookingPackage.class, 20L)).thenReturn(pkg);
        TypedQuery<Long> sessions = mock(TypedQuery.class, RETURNS_SELF);
        when(em.createQuery(anyString(), eq(Long.class))).thenReturn(sessions);
        when(sessions.getResultList()).thenReturn(List.of(1L, 2L));
        service.courtDisabled(5L, 9L);
        assertThat(pkg.getStatus()).isEqualTo(BookingStatus.CANCELLED_BY_FACILITY);
        assertThat(first.getStatus()).isEqualTo(BookingStatus.CANCELLED_BY_FACILITY);
        assertThat(second.getStatus()).isEqualTo(BookingStatus.CANCELLED_BY_FACILITY);
        verify(support).release(1L, null);
        verify(support).release(2L, null);
        verify(vouchers).restoreForFailedPackage(20L);
        verify(points).restoreForFailedPackage(20L);
        verify(vouchers, never()).restoreForFailedBooking(any());
        service.courtDisabled(5L, 9L);
        verify(points, times(1)).restoreForFailedPackage(20L);
    }
}
