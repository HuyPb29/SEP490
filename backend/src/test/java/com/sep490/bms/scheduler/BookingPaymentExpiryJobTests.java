package com.sep490.bms.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.service.payment.PaymentService;

/**
 * UC37, BR03, D80: booking lẻ hết giờ chơi mà giao dịch vẫn chờ Staff thì bị từ chối thanh toán.
 * Job chỉ tìm giao dịch Chờ xác nhận, Chờ bổ sung; mỗi giao dịch xử lý riêng.
 */
@ExtendWith(MockitoExtension.class)
class BookingPaymentExpiryJobTests {

    @Mock PaymentRepository payments;
    @Mock PaymentService paymentService;
    @InjectMocks BookingPaymentExpiryJob job;

    @Test
    void onlyPaymentsWaitingForStaffAreLookedUpForToday() {
        job.rejectPaymentsPastPlayEnd();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PaymentStatus>> statuses = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<LocalDate> today = ArgumentCaptor.forClass(LocalDate.class);
        verify(payments).findBookingPaymentExpiryCandidates(statuses.capture(), today.capture());
        assertThat(statuses.getValue())
                .containsExactlyInAnyOrder(PaymentStatus.AWAITING_CONFIRMATION, PaymentStatus.RESUBMIT_REQUESTED);
        assertThat(today.getValue()).isIn(LocalDate.now(), LocalDate.now().minusDays(1));
        verify(paymentService, never()).expireBookingPayment(any(), any());
    }

    @Test
    void everyCandidateIsExpiredWithTheSameClock() {
        when(payments.findBookingPaymentExpiryCandidates(any(), any())).thenReturn(List.of(41L, 42L));

        LocalDateTime before = LocalDateTime.now();
        job.rejectPaymentsPastPlayEnd();
        LocalDateTime after = LocalDateTime.now();

        ArgumentCaptor<LocalDateTime> first = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> second = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(paymentService).expireBookingPayment(eq(41L), first.capture());
        verify(paymentService).expireBookingPayment(eq(42L), second.capture());
        assertThat(first.getValue()).isBetween(before, after).isEqualTo(second.getValue());
    }

    @Test
    void candidateAlreadyHandledByStaffIsSkippedQuietly() {
        when(payments.findBookingPaymentExpiryCandidates(any(), any())).thenReturn(List.of(41L, 42L));
        when(paymentService.expireBookingPayment(eq(41L), any())).thenReturn(false);
        when(paymentService.expireBookingPayment(eq(42L), any())).thenReturn(true);

        job.rejectPaymentsPastPlayEnd();

        verify(paymentService).expireBookingPayment(eq(41L), any());
        verify(paymentService).expireBookingPayment(eq(42L), any());
    }

    @Test
    void oneFailingPaymentDoesNotStopTheOthers() {
        when(payments.findBookingPaymentExpiryCandidates(any(), any())).thenReturn(List.of(41L, 42L));
        when(paymentService.expireBookingPayment(eq(41L), any())).thenThrow(new IllegalStateException("xung đột khóa"));

        job.rejectPaymentsPastPlayEnd();

        verify(paymentService).expireBookingPayment(eq(42L), any());
    }
}
