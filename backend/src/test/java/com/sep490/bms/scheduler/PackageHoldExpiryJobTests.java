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

import com.sep490.bms.entity.booking.BookingPackage;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.repository.booking.BookingPackageRepository;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.service.booking.PackageService;
import com.sep490.bms.service.payment.PaymentService;

/**
 * UC37, BR53: gói giữ chỗ quá 10 phút thì hết hạn; thanh toán gói chờ Staff đã quá giờ chơi thì bị từ chối.
 * Mỗi gói, mỗi giao dịch xử lý riêng: một cái lỗi không chặn các cái sau.
 */
@ExtendWith(MockitoExtension.class)
class PackageHoldExpiryJobTests {

    @Mock BookingPackageRepository packages;
    @Mock PackageService packageService;
    @Mock PaymentRepository payments;
    @Mock PaymentService paymentService;
    @InjectMocks PackageHoldExpiryJob job;

    @Test
    void everyOverdueHoldIsExpiredWithTheSameClock() {
        when(packages.findAllByStatusAndHoldExpiresAtBefore(eq(BookingStatus.HOLDING), any()))
                .thenReturn(List.of(pkg(1L), pkg(2L)));

        LocalDateTime before = LocalDateTime.now();
        job.expireExpiredPackageHolds();
        LocalDateTime after = LocalDateTime.now();

        ArgumentCaptor<LocalDateTime> scanned = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(packages).findAllByStatusAndHoldExpiresAtBefore(eq(BookingStatus.HOLDING), scanned.capture());
        assertThat(scanned.getValue()).isBetween(before, after);
        verify(packageService).expireHold(1L, scanned.getValue());
        verify(packageService).expireHold(2L, scanned.getValue());
    }

    @Test
    void oneFailingPackageDoesNotStopTheOthers() {
        when(packages.findAllByStatusAndHoldExpiresAtBefore(eq(BookingStatus.HOLDING), any()))
                .thenReturn(List.of(pkg(1L), pkg(2L)));
        when(packageService.expireHold(eq(1L), any())).thenThrow(new IllegalStateException("khóa dòng thất bại"));

        job.expireExpiredPackageHolds();

        verify(packageService).expireHold(eq(2L), any());
        verify(payments).findPackagePaymentExpiryCandidates(any(), any());
    }

    @Test
    void waitingPackagePaymentsPastPlayEndAreRejected() {
        when(payments.findPackagePaymentExpiryCandidates(any(), any())).thenReturn(List.of(31L, 32L));

        job.expireExpiredPackageHolds();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PaymentStatus>> statuses = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<LocalDate> today = ArgumentCaptor.forClass(LocalDate.class);
        verify(payments).findPackagePaymentExpiryCandidates(statuses.capture(), today.capture());
        assertThat(statuses.getValue())
                .containsExactlyInAnyOrder(PaymentStatus.AWAITING_CONFIRMATION, PaymentStatus.RESUBMIT_REQUESTED);
        assertThat(today.getValue()).isIn(LocalDate.now(), LocalDate.now().minusDays(1));
        verify(paymentService).expirePackagePayment(eq(31L), any());
        verify(paymentService).expirePackagePayment(eq(32L), any());
    }

    @Test
    void oneFailingPaymentDoesNotStopTheOthers() {
        when(payments.findPackagePaymentExpiryCandidates(any(), any())).thenReturn(List.of(31L, 32L));
        when(paymentService.expirePackagePayment(eq(31L), any())).thenThrow(new IllegalStateException("đã đổi trạng thái"));

        job.expireExpiredPackageHolds();

        verify(paymentService).expirePackagePayment(eq(32L), any());
    }

    @Test
    void nothingOverdueMeansNothingExpired() {
        job.expireExpiredPackageHolds();

        verify(packageService, never()).expireHold(any(), any());
        verify(paymentService, never()).expirePackagePayment(any(), any());
    }

    private static BookingPackage pkg(Long id) {
        return BookingPackage.builder().id(id).status(BookingStatus.HOLDING)
                .holdExpiresAt(LocalDateTime.now().minusMinutes(1)).build();
    }
}
