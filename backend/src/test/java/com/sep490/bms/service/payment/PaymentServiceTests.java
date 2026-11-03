package com.sep490.bms.service.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;

import com.sep490.bms.dto.payment.PaymentInstructionResponse;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.exception.AppException;
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

    private final BookingService bookings = mock(BookingService.class);
    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final FileStorageService files = mock(FileStorageService.class);
    private final PaymentService service = new PaymentService(bookings, locations, files);

    private final UserPrincipal player = UserPrincipal.builder().id(PLAYER).role(Role.PLAYER).build();
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
}
