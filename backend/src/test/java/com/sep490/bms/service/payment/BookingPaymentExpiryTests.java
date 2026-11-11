package com.sep490.bms.service.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.notification.Notification;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.repository.notification.NotificationRepository;
import com.sep490.bms.repository.payment.PaymentProofRepository;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.repository.reschedule.RescheduleRequestRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.service.booking.BookingService;
import com.sep490.bms.service.booking.PackageService;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.location.LocationQueryService;
import com.sep490.bms.service.promotion.LoyaltyPointService;
import com.sep490.bms.service.promotion.VoucherService;

/** UC37, BR03, FR125 (D80): booking lẻ hết giờ chơi mà vẫn chờ Staff thì hệ thống tự từ chối thanh toán. */
class BookingPaymentExpiryTests {

    private static final Long LOCATION = 1L;
    private static final Long OWNER = 3L;
    private static final Long PLAYER = 7L;
    private static final Long BOOKING = 30L;
    private static final Long PAYMENT = 50L;
    /** Booking chơi 18:00–19:00 ngày 05/11. */
    private static final LocalDateTime PLAY_END = LocalDateTime.of(2026, 11, 5, 19, 0);

    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final BookingService bookings = mock(BookingService.class);
    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final VoucherService vouchers = mock(VoucherService.class);
    private final LoyaltyPointService points = mock(LoyaltyPointService.class);
    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final PaymentService service = new PaymentService(payments, mock(PaymentProofRepository.class), bookings,
            locations, mock(FileStorageService.class), mock(LocationAccessService.class), vouchers, points,
            notifications, mock(PackageService.class), mock(RescheduleRequestRepository.class));

    private Booking booking;
    private Payment payment;

    @BeforeEach
    void defaults() {
        booking = Booking.builder()
                .id(BOOKING)
                .bookingCode("BK000030")
                .locationId(LOCATION)
                .courtId(11L)
                .playerId(PLAYER)
                .playDate(LocalDate.of(2026, 11, 5))
                .startMinute(1080)
                .endMinute(1140)
                .listAmount(new BigDecimal("130000"))
                .finalAmount(new BigDecimal("110000"))
                .status(BookingStatus.AWAITING_CONFIRMATION)
                .build();
        payment = Payment.builder()
                .id(PAYMENT)
                .locationId(LOCATION)
                .bookingId(BOOKING)
                .amountDue(new BigDecimal("110000"))
                .status(PaymentStatus.AWAITING_CONFIRMATION)
                .submittedAt(PLAY_END.minusHours(2))
                .build();
        // Địa điểm đã bị khóa vẫn phải báo Owner.
        Location location = Location.builder().id(LOCATION).ownerId(OWNER).status("LOCKED").build();
        when(payments.findByIdForUpdate(PAYMENT)).thenReturn(Optional.of(payment));
        when(payments.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        when(bookings.lockForPayment(BOOKING)).thenReturn(booking);
        when(bookings.changeStatus(any(), any())).thenAnswer(call -> {
            Booking target = call.getArgument(0);
            target.setStatus(call.getArgument(1));
            return target;
        });
        when(locations.getByIds(anyCollection())).thenReturn(Map.of(LOCATION, location));
    }

    @Test
    void awaitingPaymentAtPlayEndIsRejectedAndTellsPlayerAndOwner() {
        assertThat(service.expireBookingPayment(PAYMENT, PLAY_END)).isTrue();

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REJECTED);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.PAYMENT_REJECTED);
        assertThat(notificationsSent()).extracting(Notification::getRecipientId).containsExactly(PLAYER, OWNER);
        assertThat(notificationsSent().get(1).getContent()).isEqualTo("Booking BK000030 đã hết giờ chơi mà chưa được "
                + "xác nhận thanh toán; hệ thống đã chuyển sang Bị từ chối thanh toán.");
    }

    @Test
    void rejectionReleasesSlotsThenReturnsVoucherAndPoints() {
        service.expireBookingPayment(PAYMENT, PLAY_END.plusMinutes(1));

        InOrder order = inOrder(payments, bookings, vouchers, points);
        order.verify(payments).findByIdForUpdate(PAYMENT);
        order.verify(bookings).lockForPayment(BOOKING);
        order.verify(bookings).changeStatus(booking, BookingStatus.PAYMENT_REJECTED);
        order.verify(bookings).releaseSlots(BOOKING);
        order.verify(vouchers).restoreForFailedBooking(BOOKING);
        order.verify(points).restoreForFailedBooking(BOOKING);
    }

    @Test
    void resubmissionRequestedAtPlayEndIsAlsoRejected() {
        payment.setStatus(PaymentStatus.RESUBMIT_REQUESTED);
        booking.setStatus(BookingStatus.RESUBMIT_REQUESTED);

        assertThat(service.expireBookingPayment(PAYMENT, PLAY_END)).isTrue();

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.PAYMENT_REJECTED);
    }

    @Test
    void beforePlayEndNothingChanges() {
        assertThat(service.expireBookingPayment(PAYMENT, PLAY_END.minusMinutes(1))).isFalse();

        assertNothingDecided();
    }

    @Test
    void paymentAlreadyHandledByStaffAfterScanIsLeftAlone() {
        payment.setStatus(PaymentStatus.CONFIRMED);

        assertThat(service.expireBookingPayment(PAYMENT, PLAY_END)).isFalse();

        verify(bookings, never()).lockForPayment(any());
        assertNothingDecided();
    }

    @Test
    void bookingNoLongerWaitingIsLeftAlone() {
        booking.setStatus(BookingStatus.CONFIRMED);

        assertThat(service.expireBookingPayment(PAYMENT, PLAY_END)).isFalse();

        assertNothingDecided();
    }

    @Test
    void packagePaymentIsNotHandledHere() {
        payment.setBookingId(null);
        payment.setPackageId(60L);

        assertThat(service.expireBookingPayment(PAYMENT, PLAY_END)).isFalse();

        verify(bookings, never()).lockForPayment(any());
        assertNothingDecided();
    }

    private List<Notification> notificationsSent() {
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications, org.mockito.Mockito.atLeast(0)).save(captor.capture());
        return captor.getAllValues();
    }

    private void assertNothingDecided() {
        verify(payments, never()).saveAndFlush(any());
        verify(bookings, never()).changeStatus(any(), any());
        verify(bookings, never()).releaseSlots(any());
        verifyNoInteractions(vouchers, points, notifications);
    }
}
