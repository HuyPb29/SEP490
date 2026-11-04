package com.sep490.bms.service.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
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
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.payment.PaymentDetailResponse;
import com.sep490.bms.dto.payment.PaymentResponse;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.payment.PaymentProof;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.payment.PaymentProofRepository;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.BookingService;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.location.LocationQueryService;

/** UC19: Staff (hoặc Owner thay Staff) xem giao dịch chờ xác nhận. */
class PaymentConfirmationTests {

    private static final Long LOCATION = 1L;
    private static final Long OTHER_LOCATION = 2L;
    private static final Long STAFF = 5L;
    private static final Long PLAYER = 7L;
    private static final Long BOOKING = 30L;
    private static final Long PAYMENT = 50L;
    /** Booking chơi 18:00–19:00 ngày 05/11; NOW sớm hơn giờ chơi. */
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 4, 12, 0, 30);

    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final PaymentProofRepository proofs = mock(PaymentProofRepository.class);
    private final BookingService bookings = mock(BookingService.class);
    private final FileStorageService files = mock(FileStorageService.class);
    private final LocationAccessService access = mock(LocationAccessService.class);
    private final PaymentService service = new PaymentService(payments, proofs, bookings,
            mock(LocationQueryService.class), files, access);

    private final UserPrincipal staff = UserPrincipal.builder().id(STAFF).role(Role.STAFF).locationId(LOCATION).build();
    private final UserPrincipal player = UserPrincipal.builder().id(PLAYER).role(Role.PLAYER).build();
    private final Location location = Location.builder().id(LOCATION).status("ACTIVE").build();
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
                .note("Cho mượn 2 vợt")
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
                .submittedAt(NOW.minusMinutes(10))
                .build();
        when(access.selectedLocation(any())).thenReturn(location);
        when(payments.findById(PAYMENT)).thenReturn(Optional.of(payment));
        when(payments.findByIdForUpdate(PAYMENT)).thenReturn(Optional.of(payment));
        when(payments.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        when(bookings.getById(BOOKING)).thenReturn(booking);
        when(bookings.lockForPayment(BOOKING)).thenReturn(booking);
        when(bookings.changeStatus(any(), any())).thenAnswer(call -> {
            Booking target = call.getArgument(0);
            target.setStatus(call.getArgument(1));
            return target;
        });
    }

    // ---------- #1, #2: danh sách và chi tiết ----------

    @Test
    void listShowsPendingPaymentsOfSelectedLocationOldestFirst() {
        when(payments.findByLocationIdAndStatusAndBookingIdIsNotNullOrderBySubmittedAtAscIdAsc(
                LOCATION, PaymentStatus.AWAITING_CONFIRMATION, PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(payment), PageRequest.of(0, 20), 1));
        when(bookings.getByIds(anyCollection())).thenReturn(Map.of(BOOKING, booking));

        PageResponse<PaymentResponse> result = service.listPending(staff, 0, 20);

        assertThat(result.getContent()).singleElement().satisfies(item -> {
            assertThat(item.getId()).isEqualTo(PAYMENT);
            assertThat(item.getBookingCode()).isEqualTo("BK000030");
            assertThat(item.getAmountDue()).isEqualByComparingTo("110000");
        });
        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void listWithBadPagingIsRejected() {
        assertThatThrownBy(() -> service.listPending(staff, 0, 101))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
        verifyNoInteractions(payments);
    }

    @Test
    void detailShowsCustomerPlayTimeNoteAndProofsNewestFirst() {
        when(bookings.getCustomer(booking)).thenReturn(new BookingService.Customer("Nguyễn Văn A", "0912345678"));
        when(bookings.getCourtName(booking)).thenReturn("Sân 1");
        when(proofs.findByPaymentIdOrderByUploadedAtDescIdDesc(PAYMENT)).thenReturn(List.of(
                PaymentProof.builder().id(81L).paymentId(PAYMENT).imagePath("b.jpg").uploadedAt(NOW).build(),
                PaymentProof.builder().id(80L).paymentId(PAYMENT).imagePath("a.jpg").uploadedAt(NOW.minusMinutes(9)).build()));

        PaymentDetailResponse result = service.getPendingDetail(staff, PAYMENT);

        assertThat(result.getCustomerName()).isEqualTo("Nguyễn Văn A");
        assertThat(result.getCustomerPhone()).isEqualTo("0912345678");
        assertThat(result.getCourtName()).isEqualTo("Sân 1");
        assertThat(result.getStartTime()).isEqualTo("18:00");
        assertThat(result.getEndTime()).isEqualTo("19:00");
        assertThat(result.getNote()).isEqualTo("Cho mượn 2 vợt");
        assertThat(result.getProofs()).extracting(PaymentDetailResponse.Proof::getImageUrl)
                .containsExactly("/api/payments/50/proofs/81/image", "/api/payments/50/proofs/80/image");
    }

    @Test
    void paymentOfAnotherLocationIsForbidden() {
        payment.setLocationId(OTHER_LOCATION);

        assertThatThrownBy(() -> service.getPendingDetail(staff, PAYMENT))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
        verify(bookings, never()).getById(any());
    }

    @Test
    void staffOfLocationAndBookerCanReadProofImage() {
        Resource image = new ByteArrayResource(new byte[] { 1 });
        when(proofs.findById(80L)).thenReturn(Optional.of(
                PaymentProof.builder().id(80L).paymentId(PAYMENT).imagePath("a.jpg").build()));
        when(files.load("a.jpg")).thenReturn(image);

        assertThat(service.loadProofImage(staff, PAYMENT, 80L)).isSameAs(image);
        assertThat(service.loadProofImage(player, PAYMENT, 80L)).isSameAs(image);
        verify(bookings).getForPlayer(BOOKING, PLAYER);
    }

    @Test
    void proofImageOfAnotherLocationIsForbidden() {
        payment.setLocationId(OTHER_LOCATION);

        assertThatThrownBy(() -> service.loadProofImage(staff, PAYMENT, 80L))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
        verifyNoInteractions(files);
    }

    @Test
    void proofOfAnotherPaymentIsNotFound() {
        when(proofs.findById(80L)).thenReturn(Optional.of(
                PaymentProof.builder().id(80L).paymentId(99L).imagePath("a.jpg").build()));

        assertThatThrownBy(() -> service.loadProofImage(staff, PAYMENT, 80L))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
        verifyNoInteractions(files);
    }
}
