package com.sep490.bms.service.payment;
import java.util.Optional;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.payment.*;
import com.sep490.bms.entity.reschedule.RescheduleRequest;
import com.sep490.bms.repository.payment.*;
import com.sep490.bms.repository.reschedule.RescheduleRequestRepository;
import com.sep490.bms.repository.notification.NotificationRepository;
import com.sep490.bms.security.*;
import com.sep490.bms.service.booking.BookingService;
import com.sep490.bms.service.booking.PackageService;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.location.LocationQueryService;
import com.sep490.bms.service.promotion.*;
import com.sep490.bms.exception.AppException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

/**
 * Kiểm tra quyền xem ảnh chứng từ và chặn truy cập ảnh thuộc giao dịch khác.
 */
class PaymentProofAccessTests {
    final PaymentRepository payments=mock(PaymentRepository.class);
    final PaymentProofRepository proofs=mock(PaymentProofRepository.class);
    final BookingService bookings=mock(BookingService.class);
    final FileStorageService files=mock(FileStorageService.class);
    final RescheduleRequestRepository requests=mock(RescheduleRequestRepository.class);
    final PaymentService service=new PaymentService(payments,proofs,bookings,mock(LocationQueryService.class),files,
            mock(LocationAccessService.class),mock(VoucherService.class),mock(LoyaltyPointService.class),mock(NotificationRepository.class),mock(PackageService.class),requests);
    final UserPrincipal player=UserPrincipal.builder().id(7L).role(Role.PLAYER).build();
    void setup() {
        when(payments.findById(1L)).thenReturn(Optional.of(Payment.builder().id(1L).rescheduleRequestId(2L).build()));
        when(requests.findById(2L)).thenReturn(Optional.of(RescheduleRequest.builder().id(2L).bookingId(3L).build()));
        when(proofs.findById(4L)).thenReturn(Optional.of(PaymentProof.builder().id(4L).paymentId(1L).imagePath("proof.png").build()));
    }
    @Test void ownerPlayerOfRescheduledBookingCanReadItsProof() {
        setup();service.loadProofImage(player,1L,4L);verify(bookings).getForPlayer(3L,7L);verify(files).load("proof.png");
    }
    @Test void anotherPlayerCannotReadTheSameProof() {
        setup();when(bookings.getForPlayer(3L,7L)).thenThrow(new AppException("Forbidden",HttpStatus.FORBIDDEN));
        assertThatThrownBy(()->service.loadProofImage(player,1L,4L)).isInstanceOf(AppException.class);verifyNoInteractions(files);
    }
    @Test void proofFromAnotherPaymentCannotBeSubstituted() {
        setup();when(proofs.findById(4L)).thenReturn(Optional.of(PaymentProof.builder().id(4L).paymentId(99L).imagePath("other.png").build()));
        assertThatThrownBy(()->service.loadProofImage(player,1L,4L)).isInstanceOf(AppException.class);verifyNoInteractions(files);
    }
}
