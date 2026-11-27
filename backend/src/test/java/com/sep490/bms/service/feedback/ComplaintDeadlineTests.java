package com.sep490.bms.service.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.inOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.sep490.bms.dto.feedback.CreateComplaintRequest;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.feedback.Complaint;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.feedback.ComplaintRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.notification.NotificationRepository;
import com.sep490.bms.security.UserPrincipal;

/** BR49, P23: khiếu nại phải gửi trong 24 giờ tính từ giờ kết thúc của booking (MSG84). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ComplaintDeadlineTests {

    @Mock ComplaintRepository complaints;
    @Mock BookingRepository bookings;
    @Mock LocationRepository locations;
    @Mock AccountRepository accounts;
    @Mock NotificationRepository notifications;
    @Mock PaymentRepository payments;
    @InjectMocks ComplaintService service;

    private final UserPrincipal player = UserPrincipal.builder().id(7L).role(Role.PLAYER).build();

    /** Booking của Player 7 kết thúc cách đây {@code hoursAgo} giờ (làm tròn theo phút). */
    private void bookingEndedHoursAgo(long hoursAgo) {
        LocalDateTime end = LocalDateTime.now().minusHours(hoursAgo).withSecond(0).withNano(0);
        when(bookings.findById(3L)).thenReturn(Optional.of(Booking.builder()
                .id(3L).playerId(7L).locationId(1L)
                .playDate(end.toLocalDate())
                .startMinute(Math.max(0, end.getHour() * 60 + end.getMinute() - 30))
                .endMinute(end.getHour() * 60 + end.getMinute())
                .build()));
    }

    private CreateComplaintRequest courtComplaint() {
        return CreateComplaintRequest.builder().bookingId(3L).complaintType("COURT_SERVICE").content("Sân trơn").build();
    }

    @Test
    void rejectsComplaintAfter24HoursFromBookingEnd() {
        bookingEndedHoursAgo(25);

        assertThatThrownBy(() -> service.createComplaint(player, courtComplaint()))
                .isInstanceOf(AppException.class)
                .hasMessage("Đã quá thời hạn gửi khiếu nại cho booking này.");
        verify(complaints, never()).saveAndFlush(any());
    }

    @Test
    void lateComplaintLocksVenueBeforePaymentAndRechecksRejectedPayment() {
        bookingEndedHoursAgo(1);
        when(locations.findByIdForUpdate(1L)).thenReturn(Optional.of(Location.builder().id(1L).build()));
        when(payments.findByIdForUpdate(8L)).thenReturn(Optional.of(Payment.builder().id(8L)
                .bookingId(3L).locationId(1L).status(PaymentStatus.REJECTED).build()));
        var request = CreateComplaintRequest.builder().bookingId(3L).paymentId(8L)
                .complaintType(Complaint.TYPE_LATE_PAYMENT_CONFIRMATION).content("Thanh toán chậm").build();
        assertThatThrownBy(() -> service.createComplaint(player, request)).isInstanceOf(AppException.class)
                .hasMessageContaining("đã được xử lý");
        var order = inOrder(locations, payments);
        order.verify(locations).findByIdForUpdate(1L);
        order.verify(payments).findByIdForUpdate(8L);
        verify(complaints, never()).saveAndFlush(any());
    }

    @Test
    void acceptsComplaintWithin24HoursFromBookingEnd() {
        bookingEndedHoursAgo(23);
        when(complaints.saveAndFlush(any())).thenAnswer(i -> {
            Complaint c = i.getArgument(0);
            c.setId(50L);
            return c;
        });
        when(accounts.findByRoleAndLocationId(Role.STAFF, 1L)).thenReturn(List.of());

        var response = service.createComplaint(player, courtComplaint());

        assertThat(response.getId()).isEqualTo(50L);
    }
}
