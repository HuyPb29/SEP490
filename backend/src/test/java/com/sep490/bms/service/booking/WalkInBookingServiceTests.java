package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.booking.BookingSummaryResponse.SlotPrice;
import com.sep490.bms.dto.booking.WalkInBookingItem;
import com.sep490.bms.dto.booking.WalkInBookingRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.BookingType;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.LocationQueryService;
import com.sep490.bms.service.payment.PaymentService;

/** UC16: Staff đặt sân tại quầy. */
class WalkInBookingServiceTests {

    private static final Long STAFF = 30L;
    private static final Long LOCATION = 1L;
    private static final Long COURT = 11L;
    private static final LocalDate DATE = LocalDate.of(2026, 11, 8);
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 6, 9, 0, 15, 500_000_000);

    private final LocationAccessService access = mock(LocationAccessService.class);
    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final CourtRepository courts = mock(CourtRepository.class);
    private final PriceCalculator prices = mock(PriceCalculator.class);
    private final BookingService bookingService = mock(BookingService.class);
    private final BookingRepository bookings = mock(BookingRepository.class);
    private final BookingCodeGenerator codes = mock(BookingCodeGenerator.class);
    private final PaymentService payments = mock(PaymentService.class);
    private final WalkInBookingService service =
            new WalkInBookingService(access, locations, courts, prices, bookingService, bookings, codes, payments);

    private final UserPrincipal staff = UserPrincipal.builder().id(STAFF).role(Role.STAFF).locationId(LOCATION).build();
    private final Location location = Location.builder().id(LOCATION).advanceBookingDays((short) 30).build();

    @BeforeEach
    void defaults() {
        when(access.selectedLocation(staff)).thenReturn(location);
        when(locations.findActive(LOCATION)).thenReturn(location);
        when(courts.findByIdAndActiveTrue(COURT))
                .thenReturn(Optional.of(Court.builder().id(COURT).locationId(LOCATION).name("Sân 1").build()));
        Map<Integer, BigDecimal> slotPrices = new LinkedHashMap<>();
        slotPrices.put(1080, new BigDecimal("60000"));
        slotPrices.put(1110, new BigDecimal("80000"));
        when(prices.rangePrices(COURT, DATE, 1080, 1140)).thenReturn(slotPrices);
        when(codes.next()).thenReturn("BK0001");
        when(bookings.save(any(Booking.class))).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            b.setId(100L);
            return b;
        });
    }

    private static WalkInBookingRequest request() {
        return new WalkInBookingRequest(COURT, DATE, 1080, 1140, "Nguyễn Văn An", "0912345678");
    }

    @Test
    void create_savesWalkInHoldingForFiveMinutesWithoutDiscounts() {
        WalkInBookingItem item = service.create(staff, request(), NOW);

        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookings).save(saved.capture());
        Booking b = saved.getValue();
        assertThat(b.getBookingType()).isEqualTo(BookingType.WALK_IN);
        assertThat(b.getPlayerId()).isNull();
        assertThat(b.getTeamId()).isNull();
        assertThat(b.getStaffId()).isEqualTo(STAFF);
        assertThat(b.getLocationId()).isEqualTo(LOCATION);
        assertThat(b.getCustomerName()).isEqualTo("Nguyễn Văn An");
        assertThat(b.getCustomerPhone()).isEqualTo("0912345678");
        assertThat(b.getListAmount()).isEqualByComparingTo("140000");
        assertThat(b.getFinalAmount()).isEqualByComparingTo("140000");
        assertThat(b.getVoucherDiscount()).isEqualByComparingTo("0");
        assertThat(b.getPointsUsed()).isZero();
        assertThat(b.getPointDiscount()).isEqualByComparingTo("0");
        assertThat(b.getNote()).isNull();
        assertThat(b.getStatus()).isEqualTo(BookingStatus.HOLDING);
        assertThat(b.getCreatedAt()).isEqualTo(LocalDateTime.of(2026, 11, 6, 9, 0, 15));
        assertThat(b.getHoldExpiresAt()).isEqualTo(LocalDateTime.of(2026, 11, 6, 9, 5, 15));

        assertThat(item.getId()).isEqualTo(100L);
        assertThat(item.getBookingCode()).isEqualTo("BK0001");
        assertThat(item.getCourtName()).isEqualTo("Sân 1");
        assertThat(item.getStartTime()).isEqualTo("18:00");
        assertThat(item.getEndTime()).isEqualTo("19:00");
        assertThat(item.getStatus()).isEqualTo(BookingStatus.HOLDING);
        assertThat(item.getHoldExpiresAt()).isEqualTo(b.getHoldExpiresAt());
    }

    @Test
    @SuppressWarnings("unchecked")
    void create_savesEachHalfHourSlotWithItsPrice() {
        service.create(staff, request(), NOW);

        ArgumentCaptor<List<SlotPrice>> slots = ArgumentCaptor.forClass(List.class);
        verify(bookingService).saveSlots(any(Booking.class), slots.capture());
        assertThat(slots.getValue()).extracting(SlotPrice::getStartMinute).containsExactly(1080, 1110);
        assertThat(slots.getValue()).extracting(SlotPrice::getPrice)
                .containsExactly(new BigDecimal("60000"), new BigDecimal("80000"));
    }

    @Test
    void create_checksSlotLikeOnlineBooking() {
        service.create(staff, request(), NOW);

        verify(bookingService).requireBookable(location, COURT, DATE, 1080, 1140, NOW);
    }

    @Test
    void create_slotTaken_savesNothing() {
        doThrow(new AppException("Slot vừa có người giữ hoặc đặt. Vui lòng chọn slot khác. (MSG28)", HttpStatus.CONFLICT))
                .when(bookingService).requireBookable(any(), any(), any(), eq(1080), eq(1140), any());

        assertThatThrownBy(() -> service.create(staff, request(), NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("MSG28");
        verify(bookings, never()).save(any());
        verify(bookingService, never()).saveSlots(any(), anyList());
    }

    @Test
    void create_courtOfAnotherLocation_forbidden() {
        when(courts.findByIdAndActiveTrue(COURT))
                .thenReturn(Optional.of(Court.builder().id(COURT).locationId(2L).name("Sân khác").build()));

        assertThatThrownBy(() -> service.create(staff, request(), NOW))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        verify(bookings, never()).save(any());
    }

    @Test
    void create_courtMissingOrTurnedOff_notFound() {
        when(courts.findByIdAndActiveTrue(COURT)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(staff, request(), NOW))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void create_lockedLocation_stopsBeforeAnything() {
        when(locations.findActive(LOCATION)).thenThrow(new AppException("Địa điểm không hoạt động", HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> service.create(staff, request(), NOW)).isInstanceOf(AppException.class);
        verify(bookings, never()).save(any());
    }

    // ---------------------------------------------------------------- UC16 #3: xác nhận

    private Booking held(BookingType type, BookingStatus status, LocalDateTime holdExpiresAt) {
        Booking booking = Booking.builder()
                .id(100L)
                .bookingCode("BK0001")
                .bookingType(type)
                .locationId(LOCATION)
                .courtId(COURT)
                .staffId(STAFF)
                .customerName("Nguyễn Văn An")
                .customerPhone("0912345678")
                .playDate(DATE)
                .startMinute(1080)
                .endMinute(1140)
                .listAmount(new BigDecimal("140000"))
                .finalAmount(new BigDecimal("140000"))
                .status(status)
                .holdExpiresAt(holdExpiresAt)
                .createdAt(NOW.minusMinutes(2))
                .build();
        when(bookingService.lockForPayment(100L)).thenReturn(booking);
        when(bookingService.getCourtName(booking)).thenReturn("Sân 1");
        return booking;
    }

    private void assertNothingConfirmed() {
        verify(payments, never()).recordWalkInPayment(any(), any(), any());
        verify(bookingService, never()).changeStatus(any(), any());
    }

    @Test
    void confirm_recordsConfirmedPaymentThenConfirmsBooking() {
        Booking booking = held(BookingType.WALK_IN, BookingStatus.HOLDING, NOW.plusMinutes(3));
        Payment payment = Payment.builder().id(50L).receiptNo("BN261106000050").confirmedAt(NOW).build();
        when(payments.recordWalkInPayment(booking, STAFF, NOW)).thenReturn(payment);
        when(bookingService.changeStatus(booking, BookingStatus.CONFIRMED)).thenAnswer(inv -> {
            booking.setStatus(BookingStatus.CONFIRMED);
            return booking;
        });

        WalkInBookingItem item = service.confirm(staff, 100L, NOW);

        InOrder order = inOrder(bookingService, payments);
        order.verify(bookingService).lockForPayment(100L);
        order.verify(payments).recordWalkInPayment(booking, STAFF, NOW);
        order.verify(bookingService).changeStatus(booking, BookingStatus.CONFIRMED);
        assertThat(item.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(item.getHoldExpiresAt()).isNull();
        assertThat(item.getPaymentId()).isEqualTo(50L);
        assertThat(item.getReceiptNo()).isEqualTo("BN261106000050");
        assertThat(item.getConfirmedAt()).isEqualTo(NOW);
        assertThat(item.getCustomerName()).isEqualTo("Nguyễn Văn An");
    }

    @Test
    void confirm_afterHoldExpired_conflictEvenBeforeJobRuns() {
        held(BookingType.WALK_IN, BookingStatus.HOLDING, NOW);

        assertThatThrownBy(() -> service.confirm(staff, 100L, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("MSG33");
        assertNothingConfirmed();
    }

    @Test
    void confirm_expiredByJob_conflict() {
        held(BookingType.WALK_IN, BookingStatus.EXPIRED, NOW.minusMinutes(1));

        assertThatThrownBy(() -> service.confirm(staff, 100L, NOW)).hasMessageContaining("MSG33");
        assertNothingConfirmed();
    }

    @Test
    void confirm_twice_secondGetsAlreadyProcessed() {
        held(BookingType.WALK_IN, BookingStatus.CONFIRMED, NOW.plusMinutes(3));

        assertThatThrownBy(() -> service.confirm(staff, 100L, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("MSG54")
                .satisfies(e -> assertThat(((AppException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT));
        assertNothingConfirmed();
    }

    @Test
    void confirm_onlineBooking_refused() {
        held(BookingType.SINGLE, BookingStatus.HOLDING, NOW.plusMinutes(3));

        assertThatThrownBy(() -> service.confirm(staff, 100L, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("không phải booking tại quầy");
        assertNothingConfirmed();
    }

    @Test
    void confirm_bookingOfAnotherLocation_forbidden() {
        held(BookingType.WALK_IN, BookingStatus.HOLDING, NOW.plusMinutes(3)).setLocationId(2L);

        assertThatThrownBy(() -> service.confirm(staff, 100L, NOW))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        assertNothingConfirmed();
    }

    // ---------------------------------------------------------------- Danh sách booking tại quầy

    private void listReturns(Booking... rows) {
        when(bookings.findLocationWalkIns(eq(LOCATION), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(rows), PageRequest.of(0, 20), rows.length));
        when(courts.findAllById(any())).thenReturn(List.of(Court.builder().id(COURT).name("Sân 1").build()));
    }

    @Test
    void list_onlyAsksForStaffLocationWithFilters() {
        listReturns();
        when(payments.findForBookings(any())).thenReturn(Map.of());

        service.list(staff, DATE, BookingStatus.CONFIRMED, 1, 5, NOW);

        verify(access).selectedLocation(staff);
        verify(bookings).findLocationWalkIns(LOCATION, DATE, BookingStatus.CONFIRMED, NOW, PageRequest.of(1, 5));
    }

    @Test
    void list_showsReceiptOfConfirmedAndExpiredForOverdueHold() {
        Booking confirmed = held(BookingType.WALK_IN, BookingStatus.CONFIRMED, NOW.minusMinutes(30));
        Booking overdue = Booking.builder().id(101L).bookingCode("BK0002").bookingType(BookingType.WALK_IN)
                .locationId(LOCATION).courtId(COURT).customerName("Trần Bình").customerPhone("0987654321")
                .playDate(DATE).startMinute(1200).endMinute(1260).finalAmount(new BigDecimal("80000"))
                .status(BookingStatus.HOLDING).holdExpiresAt(NOW.minusSeconds(1)).createdAt(NOW.minusMinutes(6))
                .build();
        listReturns(confirmed, overdue);
        when(payments.findForBookings(List.of(100L, 101L))).thenReturn(Map.of(100L,
                Payment.builder().id(50L).bookingId(100L).receiptNo("BN261106000050").confirmedAt(NOW).build()));

        PageResponse<WalkInBookingItem> page = service.list(staff, null, null, 0, 20, NOW);

        WalkInBookingItem first = page.getContent().get(0);
        assertThat(first.getCourtName()).isEqualTo("Sân 1");
        assertThat(first.getReceiptNo()).isEqualTo("BN261106000050");
        assertThat(first.getCustomerPhone()).isEqualTo("0912345678");
        WalkInBookingItem second = page.getContent().get(1);
        assertThat(second.getStatus()).isEqualTo(BookingStatus.EXPIRED);
        assertThat(second.getHoldExpiresAt()).isNull();
        assertThat(second.getPaymentId()).isNull();
        assertThat(page.getTotalElements()).isEqualTo(2);
    }

    @Test
    void list_invalidPage_rejected() {
        assertThatThrownBy(() -> service.list(staff, null, null, 0, 101, NOW)).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.list(staff, null, null, -1, 20, NOW)).isInstanceOf(AppException.class);
    }
}
