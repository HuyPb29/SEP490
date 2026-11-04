package com.sep490.bms.service.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import com.sep490.bms.dto.payment.PaymentInstructionResponse;
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

class PaymentServiceTests {

    private static final Long LOCATION = 1L;
    private static final Long PLAYER = 7L;
    private static final Long BOOKING = 30L;
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 3, 12, 0);
    private static final String QR_PATH = "uploads/qr/location_1.png";
    private static final Long PAYMENT = 50L;
    private static final String PROOF_PATH = "payment-proofs/2026/11/a.jpg";

    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final PaymentProofRepository proofs = mock(PaymentProofRepository.class);
    private final BookingService bookings = mock(BookingService.class);
    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final FileStorageService files = mock(FileStorageService.class);
    private final PaymentService service = new PaymentService(payments, proofs, bookings, locations, files,
            mock(LocationAccessService.class));

    private final UserPrincipal player = UserPrincipal.builder().id(PLAYER).role(Role.PLAYER).build();
    private final MockMultipartFile proof = new MockMultipartFile("proof", "ck.jpg", "image/jpeg", new byte[] { 1, 2 });
    private Booking booking;

    @BeforeEach
    void defaults() {
        booking = Booking.builder()
                .id(BOOKING)
                .bookingCode("BK000030")
                .locationId(LOCATION)
                .playerId(PLAYER)
                .playDate(LocalDate.of(2026, 11, 5))
                .startMinute(1080)
                .endMinute(1140)
                .listAmount(new BigDecimal("130000"))
                .finalAmount(new BigDecimal("110000"))
                .status(BookingStatus.HOLDING)
                .holdExpiresAt(NOW.plusMinutes(3))
                .build();
        when(bookings.getForPlayer(BOOKING, PLAYER)).thenReturn(booking);
        when(bookings.lockForPayment(BOOKING)).thenReturn(booking);
        when(files.storeImage(any(), anyString())).thenReturn(PROOF_PATH);
        when(payments.saveAndFlush(any())).thenAnswer(call -> {
            Payment payment = call.getArgument(0);
            payment.setId(PAYMENT);
            return payment;
        });
        when(locations.findActive(LOCATION)).thenReturn(Location.builder()
                .id(LOCATION)
                .bankName("Vietcombank")
                .bankAccountNo("0011001234567")
                .bankAccountHolder("NGUYEN MINH KHOI")
                .qrImagePath(QR_PATH)
                .build());
    }

    @Test
    void instructionsShowAmountAfterDiscountsBankAccountAndHoldTime() {
        PaymentInstructionResponse result = service.getInstructions(player, BOOKING, NOW);

        assertThat(result.getAmountDue()).isEqualByComparingTo("110000");
        assertThat(result.getBankName()).isEqualTo("Vietcombank");
        assertThat(result.getBankAccountNo()).isEqualTo("0011001234567");
        assertThat(result.getBankAccountHolder()).isEqualTo("NGUYEN MINH KHOI");
        assertThat(result.getQrImageUrl()).isEqualTo("/api/bookings/30/payment-instructions/qr");
        assertThat(result.getHoldExpiresAt()).isEqualTo(NOW.plusMinutes(3));
        assertThat(result.getStatus()).isEqualTo(BookingStatus.HOLDING);
    }

    @Test
    void instructionsWhenResubmitRequestedHaveNoHoldTime() {
        booking.setStatus(BookingStatus.RESUBMIT_REQUESTED);

        PaymentInstructionResponse result = service.getInstructions(player, BOOKING, NOW);

        assertThat(result.getHoldExpiresAt()).isNull();
        assertThat(result.getAmountDue()).isEqualByComparingTo("110000");
    }

    @Test
    void locationWithoutQrImageHasNoQrUrl() {
        when(locations.findActive(LOCATION)).thenReturn(Location.builder().id(LOCATION).build());

        assertThat(service.getInstructions(player, BOOKING, NOW).getQrImageUrl()).isNull();
    }

    @Test
    void holdPastFiveMinutesIsExpiredEvenBeforeJobRuns() {
        booking.setHoldExpiresAt(NOW);

        assertThatThrownBy(() -> service.getInstructions(player, BOOKING, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("MSG33")
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void bookingAlreadyReportedHasNoInstructions() {
        booking.setStatus(BookingStatus.AWAITING_CONFIRMATION);

        assertThatThrownBy(() -> service.getInstructions(player, BOOKING, NOW))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void sessionOfPackageIsPaidWithThePackage() {
        booking.setPackageId(3L);

        assertThatThrownBy(() -> service.getInstructions(player, BOOKING, NOW))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void qrImageIsReadFromLocationPath() {
        Resource image = new ByteArrayResource(new byte[] { 1 });
        when(files.load(QR_PATH)).thenReturn(image);

        assertThat(service.loadQrImage(player, BOOKING, NOW)).isSameAs(image);
    }

    @Test
    void qrImageMissingIsNotFound() {
        when(locations.findActive(LOCATION)).thenReturn(Location.builder().id(LOCATION).build());

        assertThatThrownBy(() -> service.loadQrImage(player, BOOKING, NOW))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ---------------------------------------------------------------- Báo đã thanh toán

    @Test
    void submitCreatesPaymentWithAmountAfterDiscountsAndFirstProof() {
        PaymentResponse result = service.submitProof(player, BOOKING, proof, NOW);

        ArgumentCaptor<Payment> payment = ArgumentCaptor.forClass(Payment.class);
        verify(payments).saveAndFlush(payment.capture());
        assertThat(payment.getValue().getBookingId()).isEqualTo(BOOKING);
        assertThat(payment.getValue().getLocationId()).isEqualTo(LOCATION);
        assertThat(payment.getValue().getAmountDue()).isEqualByComparingTo("110000");
        assertThat(payment.getValue().getStatus()).isEqualTo(PaymentStatus.AWAITING_CONFIRMATION);
        assertThat(payment.getValue().getSubmittedAt()).isEqualTo(NOW);

        ArgumentCaptor<PaymentProof> saved = ArgumentCaptor.forClass(PaymentProof.class);
        verify(proofs).save(saved.capture());
        assertThat(saved.getValue().getPaymentId()).isEqualTo(PAYMENT);
        assertThat(saved.getValue().getImagePath()).isEqualTo(PROOF_PATH);

        assertThat(result.getId()).isEqualTo(PAYMENT);
        assertThat(result.getStatus()).isEqualTo(PaymentStatus.AWAITING_CONFIRMATION);
        assertThat(result.getResubmitsLeft()).isEqualTo(3);
    }

    @Test
    void submitLocksBookingChecksThenStoresImageThenMovesBookingToAwaitingConfirmation() {
        service.submitProof(player, BOOKING, proof, NOW);

        InOrder order = inOrder(bookings, files, payments, proofs);
        order.verify(bookings).lockForPayment(BOOKING);
        order.verify(bookings).requireBooker(booking, PLAYER);
        order.verify(files).storeImage(proof, "payment-proofs");
        order.verify(payments).saveAndFlush(any());
        order.verify(proofs).save(any());
        order.verify(bookings).changeStatus(booking, BookingStatus.AWAITING_CONFIRMATION);
    }

    @Test
    void submitWithoutImageIsRejectedBeforeAnything() {
        MockMultipartFile empty = new MockMultipartFile("proof", "ck.jpg", "image/jpeg", new byte[0]);

        assertThatThrownBy(() -> service.submitProof(player, BOOKING, empty, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("MSG106")
                .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
        assertThatThrownBy(() -> service.submitProof(player, BOOKING, null, NOW)).hasMessageContaining("MSG106");
        verifyNoInteractions(bookings, files, payments, proofs);
    }

    @Test
    void submitForBookingOfAnotherPlayerSavesNothing() {
        doThrow(new AppException("Bạn không có quyền xem booking này", HttpStatus.FORBIDDEN))
                .when(bookings).requireBooker(booking, PLAYER);

        assertThatThrownBy(() -> service.submitProof(player, BOOKING, proof, NOW))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
        assertNothingSaved();
    }

    @Test
    void submitAfterHoldExpiredIsMsg33AndSavesNothing() {
        booking.setHoldExpiresAt(NOW.minusSeconds(1));

        assertThatThrownBy(() -> service.submitProof(player, BOOKING, proof, NOW)).hasMessageContaining("MSG33");
        assertNothingSaved();
    }

    @Test
    void submitAfterJobExpiredBookingIsMsg33() {
        booking.setStatus(BookingStatus.EXPIRED);

        assertThatThrownBy(() -> service.submitProof(player, BOOKING, proof, NOW)).hasMessageContaining("MSG33");
        assertNothingSaved();
    }

    @Test
    void secondSubmitForSameBookingIsConflictAndSavesNothing() {
        booking.setStatus(BookingStatus.AWAITING_CONFIRMATION);

        assertThatThrownBy(() -> service.submitProof(player, BOOKING, proof, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("đã được báo thanh toán")
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
        assertNothingSaved();
    }

    @Test
    void uniquePaymentPerBookingIsTheLastGuard() {
        doThrow(new DataIntegrityViolationException("insert",
                new SQLException("Cannot insert duplicate key row in object 'dbo.payment' with unique index 'ux_payment_booking'.")))
                .when(payments).saveAndFlush(any());

        assertThatThrownBy(() -> service.submitProof(player, BOOKING, proof, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("đã được báo thanh toán")
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
        verify(proofs, never()).save(any());
        verify(bookings, never()).changeStatus(any(), any());
    }

    private void assertNothingSaved() {
        verify(files, never()).storeImage(any(), anyString());
        verifyNoInteractions(payments, proofs);
        verify(bookings, never()).changeStatus(any(), any());
    }

    // ---------------------------------------------------------------- Gửi lại chứng từ

    @Test
    void resubmitAddsNewProofAndGoesBackToAwaitingConfirmation() {
        Payment payment = resubmitRequested(NOW.plusHours(2));

        PaymentResponse result = service.resubmitProof(player, PAYMENT, proof, NOW);

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.AWAITING_CONFIRMATION);
        assertThat(payment.getSubmittedAt()).isEqualTo(NOW);
        ArgumentCaptor<PaymentProof> saved = ArgumentCaptor.forClass(PaymentProof.class);
        verify(proofs).save(saved.capture());
        assertThat(saved.getValue().getPaymentId()).isEqualTo(PAYMENT);
        assertThat(saved.getValue().getImagePath()).isEqualTo(PROOF_PATH);
        verify(proofs, never()).delete(any());
        assertThat(result.getResubmitsLeft()).isEqualTo(2);
    }

    @Test
    void resubmitLocksPaymentThenBookingThenSaves() {
        resubmitRequested(NOW.plusHours(2));

        service.resubmitProof(player, PAYMENT, proof, NOW);

        InOrder order = inOrder(payments, bookings, files, proofs);
        order.verify(payments).findByIdForUpdate(PAYMENT);
        order.verify(bookings).lockForPayment(BOOKING);
        order.verify(bookings).requireBooker(booking, PLAYER);
        order.verify(files).storeImage(proof, "payment-proofs");
        order.verify(proofs).save(any());
        order.verify(payments).saveAndFlush(any());
        order.verify(bookings).changeStatus(booking, BookingStatus.AWAITING_CONFIRMATION);
    }

    @Test
    void resubmitAfterDeadlineIsMsg52AndSavesNothing() {
        resubmitRequested(NOW.minusMinutes(1));

        assertThatThrownBy(() -> service.resubmitProof(player, PAYMENT, proof, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("MSG52")
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
        assertNothingResubmitted();
    }

    @Test
    void resubmitWithoutDeadlineUsesEndOfPlayTime() {
        resubmitRequested(null);
        LocalDateTime endOfPlay = LocalDate.of(2026, 11, 5).atTime(19, 0);

        assertThatThrownBy(() -> service.resubmitProof(player, PAYMENT, proof, endOfPlay.plusSeconds(1)))
                .hasMessageContaining("MSG52");
        assertNothingResubmitted();
    }

    @Test
    void resubmitWhenStaffDidNotAskIsConflict() {
        Payment payment = resubmitRequested(NOW.plusHours(2));
        payment.setStatus(PaymentStatus.AWAITING_CONFIRMATION);

        assertThatThrownBy(() -> service.resubmitProof(player, PAYMENT, proof, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("không chờ bổ sung")
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
        assertNothingResubmitted();
    }

    @Test
    void resubmitForPaymentOfAnotherPlayerSavesNothing() {
        resubmitRequested(NOW.plusHours(2));
        doThrow(new AppException("Bạn không có quyền xem booking này", HttpStatus.FORBIDDEN))
                .when(bookings).requireBooker(booking, PLAYER);

        assertThatThrownBy(() -> service.resubmitProof(player, PAYMENT, proof, NOW))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
        assertNothingResubmitted();
    }

    @Test
    void resubmitWithoutImageIsMsg106() {
        assertThatThrownBy(() -> service.resubmitProof(player, PAYMENT, null, NOW)).hasMessageContaining("MSG106");
        verifyNoInteractions(payments, bookings, files, proofs);
    }

    @Test
    void resubmitForMissingPaymentIsNotFound() {
        when(payments.findByIdForUpdate(PAYMENT)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resubmitProof(player, PAYMENT, proof, NOW))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }


    // ---------------------------------------------------------------- Xem thanh toán

    @Test
    void playerSeesStatusAndReceiptOfOwnPayment() {
        Payment payment = Payment.builder()
                .id(PAYMENT)
                .bookingId(BOOKING)
                .amountDue(new BigDecimal("110000"))
                .receivedAmount(new BigDecimal("110000"))
                .status(PaymentStatus.CONFIRMED)
                .confirmedAt(NOW)
                .receiptNo("RC00000030")
                .build();
        when(payments.findById(PAYMENT)).thenReturn(Optional.of(payment));

        PaymentResponse result = service.getPayment(player, PAYMENT);

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.CONFIRMED);
        assertThat(result.getReceiptNo()).isEqualTo("RC00000030");
        assertThat(result.getBookingCode()).isEqualTo("BK000030");
        assertThat(result.getAmountDue()).isEqualByComparingTo("110000");
        verify(bookings).getForPlayer(BOOKING, PLAYER);
        verify(payments, never()).saveAndFlush(any());
    }

    @Test
    void paymentOfAnotherPlayerIsForbidden() {
        when(payments.findById(PAYMENT)).thenReturn(Optional.of(
                Payment.builder().id(PAYMENT).bookingId(BOOKING).build()));
        when(bookings.getForPlayer(BOOKING, PLAYER))
                .thenThrow(new AppException("Bạn không có quyền xem booking này", HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> service.getPayment(player, PAYMENT))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void missingPaymentIsNotFound() {
        when(payments.findById(PAYMENT)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPayment(player, PAYMENT))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }

    /** Booking đang Chờ bổ sung, Staff đã trừ một lượt vì lỗi do Player. */
    private Payment resubmitRequested(LocalDateTime deadline) {
        booking.setStatus(BookingStatus.RESUBMIT_REQUESTED);
        Payment payment = Payment.builder()
                .id(PAYMENT)
                .locationId(LOCATION)
                .bookingId(BOOKING)
                .amountDue(new BigDecimal("110000"))
                .status(PaymentStatus.RESUBMIT_REQUESTED)
                .resubmitCount(1)
                .resubmitReason("Ảnh mờ")
                .resubmitDeadline(deadline)
                .submittedAt(NOW.minusHours(1))
                .build();
        when(payments.findByIdForUpdate(PAYMENT)).thenReturn(Optional.of(payment));
        return payment;
    }

    private void assertNothingResubmitted() {
        verify(files, never()).storeImage(any(), anyString());
        verifyNoInteractions(proofs);
        verify(payments, never()).saveAndFlush(any());
        verify(bookings, never()).changeStatus(any(), any());
    }
}
