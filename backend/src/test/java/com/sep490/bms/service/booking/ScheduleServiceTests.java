package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.sep490.bms.dto.booking.ScheduleResponse;
import com.sep490.bms.dto.booking.ScheduleResponse.SlotCell;
import com.sep490.bms.dto.booking.ScheduleResponse.SlotStatus;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.booking.BookingSlot;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.booking.BookingSlotRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.SlotAvailabilityService.OpeningWindow;
import com.sep490.bms.service.location.CourtQueryService;
import com.sep490.bms.service.location.LocationQueryService;

class ScheduleServiceTests {

    private static final Long LOCATION = 1L;
    private static final Long COURT = 5L;
    private static final Long OWNER = 10L;
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 30);
    /** Hôm nay 12:10, giữa slot 12:00. */
    private static final LocalDateTime NOW = TODAY.atTime(12, 10);
    private static final LocalDate TOMORROW = TODAY.plusDays(1);

    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final CourtQueryService courts = mock(CourtQueryService.class);
    private final SlotAvailabilityService availability = mock(SlotAvailabilityService.class);
    private final PriceCalculator prices = mock(PriceCalculator.class);
    private final BookingSlotRepository slots = mock(BookingSlotRepository.class);
    private final BookingRepository bookings = mock(BookingRepository.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final ScheduleService service = new ScheduleService(
            locations, courts, availability, prices, slots, bookings, accounts);

    private final Location location = Location.builder().id(LOCATION).ownerId(OWNER).build();

    @BeforeEach
    void defaults() {
        when(locations.findActive(LOCATION)).thenReturn(location);
        when(courts.activeCourts(LOCATION)).thenReturn(
                List.of(Court.builder().id(COURT).locationId(LOCATION).name("Sân 1").build()));
        // Mặc định lịch có các cột 10:00–14:00 và ngày đang xem mở đúng khoảng đó
        when(availability.scheduleRange(any(), any())).thenReturn(Optional.of(new OpeningWindow(600, 840)));
        when(availability.openingWindow(any(), any())).thenReturn(Optional.of(new OpeningWindow(600, 840)));
        when(availability.maintenanceStarts(any(), any())).thenReturn(Map.of());
        when(prices.slotPrices(any(), any())).thenReturn(Map.of(COURT, Map.of(780, new BigDecimal("60000"))));
    }

    @Test
    void emptySlotIsAvailableWithPrice() {
        SlotCell cell = cell(service.schedule(LOCATION, TOMORROW, null, NOW), 780);

        assertThat(cell.getStatus()).isEqualTo(SlotStatus.AVAILABLE);
        assertThat(cell.getTime()).isEqualTo("13:00");
        assertThat(cell.getPrice()).isEqualByComparingTo("60000");
    }

    @Test
    void missingDateMeansToday() {
        assertThat(service.schedule(LOCATION, null, null, NOW).getDate()).isEqualTo(TODAY);
    }

    @Test
    void slotOutsideOpeningHoursOfThatDayIsClosedWithoutPrice() {
        when(availability.openingWindow(any(), any())).thenReturn(Optional.of(new OpeningWindow(600, 780)));

        SlotCell cell = cell(service.schedule(LOCATION, TOMORROW, null, NOW), 780);

        assertThat(cell.getStatus()).isEqualTo(SlotStatus.CLOSED);
        assertThat(cell.getPrice()).isNull();
    }

    @Test
    void closedDayHasEveryColumnClosed() {
        when(availability.openingWindow(any(), any())).thenReturn(Optional.empty());

        var row = service.schedule(LOCATION, TOMORROW, null, NOW).getCourts().get(0);

        assertThat(row.getSlots()).isNotEmpty().allMatch(c -> c.getStatus() == SlotStatus.CLOSED);
    }

    @Test
    void approvedMaintenanceIsShown() {
        when(availability.maintenanceStarts(any(), any())).thenReturn(Map.of(COURT, Set.of(780)));

        assertThat(cell(service.schedule(LOCATION, TOMORROW, null, NOW), 780).getStatus())
                .isEqualTo(SlotStatus.MAINTENANCE);
    }

    @Test
    void emptySlotThatAlreadyStartedTodayIsPast() {
        ScheduleResponse today = service.schedule(LOCATION, TODAY, null, NOW);

        assertThat(cell(today, 690).getStatus()).isEqualTo(SlotStatus.PAST);
        assertThat(cell(today, 720).getStatus()).as("slot 12:00 đã bắt đầu lúc 12:10").isEqualTo(SlotStatus.PAST);
        assertThat(cell(today, 750).getStatus()).isEqualTo(SlotStatus.AVAILABLE);
    }

    @Test
    void unpaidBookingShowsHolding() {
        for (BookingStatus status : List.of(BookingStatus.HOLDING, BookingStatus.AWAITING_CONFIRMATION,
                BookingStatus.RESUBMIT_REQUESTED)) {
            bookingAt(TOMORROW, 780, status, 7L);

            assertThat(cell(service.schedule(LOCATION, TOMORROW, null, NOW), 780).getStatus())
                    .as(status.name()).isEqualTo(SlotStatus.HOLDING);
        }
    }

    @Test
    void paidBookingIsBookedUntilItsTimeFrame() {
        bookingAt(TOMORROW, 780, BookingStatus.CONFIRMED, 7L);

        assertThat(cell(service.schedule(LOCATION, TOMORROW, null, NOW), 780).getStatus())
                .isEqualTo(SlotStatus.BOOKED);
    }

    @Test
    void paidBookingIsInUseDuringItsFrameEvenIfStatusNotYetChanged() {
        bookingAt(TODAY, 720, BookingStatus.CONFIRMED, 7L);

        assertThat(cell(service.schedule(LOCATION, TODAY, null, NOW), 720).getStatus())
                .isEqualTo(SlotStatus.IN_USE);
    }

    @Test
    void newSlotOfPendingRescheduleIsHolding() {
        Booking booking = booking(BookingStatus.CONFIRMED, 7L, TOMORROW, 600);
        BookingSlot newSlot = BookingSlot.builder().bookingId(booking.getId()).courtId(COURT)
                .slotDate(TOMORROW).slotStartMinute(780).rescheduleRequestId(3L).build();
        when(slots.findByCourtIdInAndSlotDateAndActiveTrue(any(), any())).thenReturn(List.of(newSlot));
        when(bookings.findAllById(any())).thenReturn(List.of(booking));

        assertThat(cell(service.schedule(LOCATION, TOMORROW, null, NOW), 780).getStatus())
                .isEqualTo(SlotStatus.HOLDING);
    }

    @Test
    void guestAndPlayerDoNotSeeBookerInfo() {
        bookingAt(TOMORROW, 780, BookingStatus.CONFIRMED, 7L);

        for (UserPrincipal viewer : new UserPrincipal[] { null, user(7L, Role.PLAYER, null) }) {
            SlotCell cell = cell(service.schedule(LOCATION, TOMORROW, viewer, NOW), 780);

            assertThat(cell.getBookerName()).isNull();
            assertThat(cell.getBookerPhone()).isNull();
            assertThat(cell.getNote()).isNull();
        }
        verifyNoInteractions(accounts);
    }

    @Test
    void ownerOfLocationSeesPlayerNamePhoneAndNote() {
        bookingAt(TOMORROW, 780, BookingStatus.CONFIRMED, 7L);
        when(accounts.findAllById(any())).thenReturn(List.of(Account.builder()
                .id(7L).fullName("Nguyễn An").phone("0912345678").build()));

        SlotCell cell = cell(service.schedule(LOCATION, TOMORROW, user(OWNER, Role.OWNER, null), NOW), 780);

        assertThat(cell.getBookerName()).isEqualTo("Nguyễn An");
        assertThat(cell.getBookerPhone()).isEqualTo("0912345678");
        assertThat(cell.getNote()).isEqualTo("Mượn vợt");
    }

    @Test
    void staffOfLocationSeesWalkInCustomer() {
        bookingAt(TOMORROW, 780, BookingStatus.CONFIRMED, null);

        SlotCell cell = cell(service.schedule(LOCATION, TOMORROW, user(20L, Role.STAFF, LOCATION), NOW), 780);

        assertThat(cell.getBookerName()).isEqualTo("Khách quầy");
        assertThat(cell.getBookerPhone()).isEqualTo("0987654321");
    }

    @Test
    void ownerAndStaffOfAnotherLocationSeeLikeGuest() {
        bookingAt(TOMORROW, 780, BookingStatus.CONFIRMED, 7L);

        for (UserPrincipal viewer : new UserPrincipal[] { user(99L, Role.OWNER, null), user(20L, Role.STAFF, 2L) }) {
            assertThat(cell(service.schedule(LOCATION, TOMORROW, viewer, NOW), 780).getBookerPhone()).isNull();
        }
    }

    @Test
    void guestIsLimitedToAdvanceBookingDays() {
        location.setAdvanceBookingDays((short) 30);

        assertThat(service.schedule(LOCATION, TODAY.plusDays(30), null, NOW).getMaxDate())
                .isEqualTo(TODAY.plusDays(30));
        assertThatThrownBy(() -> service.schedule(LOCATION, TODAY.plusDays(31), null, NOW))
                .isInstanceOf(AppException.class);
    }

    @Test
    void managerCanSeeThreeMonthsAhead() {
        location.setAdvanceBookingDays((short) 30);
        UserPrincipal owner = user(OWNER, Role.OWNER, null);
        LocalDate limit = TODAY.plusMonths(3);

        assertThat(service.schedule(LOCATION, limit, owner, NOW).getMaxDate()).isEqualTo(limit);
        assertThatThrownBy(() -> service.schedule(LOCATION, limit.plusDays(1), owner, NOW))
                .isInstanceOf(AppException.class);
    }

    @Test
    void managerKeepsLongerAdvanceBookingDays() {
        location.setAdvanceBookingDays((short) 120);

        assertThat(service.schedule(LOCATION, null, user(OWNER, Role.OWNER, null), NOW).getMaxDate())
                .isEqualTo(TODAY.plusDays(120));
    }

    @Test
    void pastDateIsRejected() {
        assertThatThrownBy(() -> service.schedule(LOCATION, TODAY.minusDays(1), null, NOW))
                .isInstanceOf(AppException.class);
    }

    private static SlotCell cell(ScheduleResponse schedule, int startMinute) {
        return schedule.getCourts().get(0).getSlots().stream()
                .filter(c -> c.getStartMinute() == startMinute).findFirst().orElseThrow();
    }

    /** Booking 1 slot; playerId null là booking tại quầy. */
    private void bookingAt(LocalDate date, int startMinute, BookingStatus status, Long playerId) {
        Booking booking = booking(status, playerId, date, startMinute);
        BookingSlot slot = BookingSlot.builder().bookingId(booking.getId()).courtId(COURT)
                .slotDate(date).slotStartMinute(startMinute).build();
        when(slots.findByCourtIdInAndSlotDateAndActiveTrue(any(), any())).thenReturn(List.of(slot));
        when(bookings.findAllById(any())).thenReturn(List.of(booking));
    }

    private static Booking booking(BookingStatus status, Long playerId, LocalDate date, int startMinute) {
        return Booking.builder().id(100L).courtId(COURT).playerId(playerId)
                .customerName(playerId == null ? "Khách quầy" : null)
                .customerPhone(playerId == null ? "0987654321" : null)
                .playDate(date).startMinute(startMinute).endMinute(startMinute + 30)
                .note("Mượn vợt").status(status).build();
    }

    private static UserPrincipal user(Long id, Role role, Long locationId) {
        return UserPrincipal.builder().id(id).role(role).locationId(locationId).build();
    }
}
