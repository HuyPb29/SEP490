package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
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
import org.springframework.http.HttpStatus;

import com.sep490.bms.dto.booking.BookingSummaryResponse.SlotPrice;
import com.sep490.bms.dto.booking.WalkInBookingItem;
import com.sep490.bms.dto.booking.WalkInBookingRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.BookingType;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.LocationQueryService;

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
    private final WalkInBookingService service =
            new WalkInBookingService(access, locations, courts, prices, bookingService, bookings, codes);

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
}
