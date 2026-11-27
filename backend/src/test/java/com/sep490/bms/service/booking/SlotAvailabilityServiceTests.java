package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.sep490.bms.entity.booking.BookingSlot;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.Maintenance;
import com.sep490.bms.entity.location.OpeningException;
import com.sep490.bms.entity.location.OpeningHour;
import com.sep490.bms.repository.booking.BookingSlotRepository;
import com.sep490.bms.repository.location.MaintenanceRepository;
import com.sep490.bms.repository.location.OpeningExceptionRepository;
import com.sep490.bms.repository.location.OpeningHourRepository;
import com.sep490.bms.service.booking.SlotAvailabilityService.OpeningWindow;
import com.sep490.bms.service.booking.SlotAvailabilityService.SlotProblem;

/**
 * Kiểm tra slot trống, slot đã giữ, lịch bảo trì và khung giờ ngoài giờ mở cửa.
 */
class SlotAvailabilityServiceTests {

    private static final Long LOCATION = 1L;
    private static final Long COURT = 5L;
    private static final LocalDate DATE = LocalDate.of(2026, 11, 2);
    private static final Long OTHER_COURT = 6L;
    private static final Duration FIFTEEN_MINUTES = Duration.ofMinutes(15);

    private final OpeningHourRepository hours = mock(OpeningHourRepository.class);
    private final OpeningExceptionRepository exceptions = mock(OpeningExceptionRepository.class);
    private final BookingSlotRepository slots = mock(BookingSlotRepository.class);
    private final MaintenanceRepository maintenance = mock(MaintenanceRepository.class);
    private final com.sep490.bms.repository.location.CourtRepository courts = mock(com.sep490.bms.repository.location.CourtRepository.class);
    private final com.sep490.bms.repository.location.ServiceTermRepository terms = mock(com.sep490.bms.repository.location.ServiceTermRepository.class);
    private final SlotAvailabilityService service =
            new SlotAvailabilityService(hours, exceptions, slots, maintenance,
                    courts, terms);

    @Test
    void newlyPurchasedCourtCannotBeBookedBeforeItsEffectiveDate() {
        when(courts.findById(COURT)).thenReturn(Optional.of(com.sep490.bms.entity.location.Court.builder()
                .id(COURT).availableFrom(DATE.plusDays(1)).build()));
        assertThat(service.findProblem(LOCATION, COURT, DATE, 600, 630)).contains(SlotProblem.CLOSED);
        assertThat(service.findProblem(LOCATION, COURT, DATE.plusDays(1), 600, 630)).isEmpty();
    }

    @Test
    void purchasedCourtExpiresWithContractButHonorsRecordedRenewals() {
        var court = com.sep490.bms.entity.location.Court.builder().id(COURT).locationId(LOCATION)
                .availableFrom(DATE.minusDays(10)).availableUntil(DATE).build();
        when(courts.findById(COURT)).thenReturn(Optional.of(court));
        assertThat(service.findProblem(LOCATION, COURT, DATE, 600, 630)).isEmpty();
        assertThat(service.findProblem(LOCATION, COURT, DATE.plusDays(1), 600, 630)).contains(SlotProblem.CLOSED);
        when(terms.existsByLocationIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(LOCATION, DATE.plusDays(1), DATE.plusDays(1)))
                .thenReturn(true);
        assertThat(service.findProblem(LOCATION, COURT, DATE.plusDays(1), 600, 630)).isEmpty();
    }

    @BeforeEach
    void openFrom6To22() {
        when(exceptions.findByLocationIdAndExceptionDate(any(), any())).thenReturn(Optional.empty());
        when(hours.findByLocationIdAndDayOfWeek(any(), anyInt())).thenReturn(Optional.of(
                OpeningHour.builder().openMinute(360).closeMinute(1320).build()));
        when(slots.findByCourtIdInAndSlotDateAndActiveTrue(any(), any())).thenReturn(List.of());
        when(maintenance.findByCourtIdInAndStatusAndStartAtLessThanAndEndAtGreaterThan(any(), any(), any(), any()))
                .thenReturn(List.of());
    }

    @Test
    void freeSlotsHaveNoProblem() {
        assertThat(problem(600, 660)).isEmpty();
    }

    @Test
    void rangeEndingAfterClosingIsClosed() {
        assertThat(problem(1290, 1350)).contains(SlotProblem.CLOSED);
    }

    @Test
    void dayWithoutOpeningHoursIsClosed() {
        when(hours.findByLocationIdAndDayOfWeek(any(), anyInt())).thenReturn(Optional.empty());

        assertThat(problem(600, 660)).contains(SlotProblem.CLOSED);
    }

    @Test
    void oneHeldSlotInsideRangeIsTaken() {
        when(slots.findByCourtIdInAndSlotDateAndActiveTrue(any(), any())).thenReturn(List.of(
                BookingSlot.builder().courtId(COURT).slotDate(DATE).slotStartMinute(630).build()));

        assertThat(problem(600, 690)).contains(SlotProblem.TAKEN);
        assertThat(problem(660, 720)).as("khoảng khác không bị ảnh hưởng").isEmpty();
    }

    @Test
    void rescheduleIgnoresOnlyItsOwnBookingSlots() {
        when(slots.findByCourtIdInAndSlotDateAndActiveTrue(any(), any())).thenReturn(List.of(
                BookingSlot.builder().bookingId(10L).courtId(COURT).slotDate(DATE).slotStartMinute(540).build(),
                BookingSlot.builder().bookingId(11L).courtId(COURT).slotDate(DATE).slotStartMinute(630).build()));
        assertThat(service.findProblem(LOCATION, COURT, DATE, 510, 600, 10L)).isEmpty();
        assertThat(service.findProblem(LOCATION, COURT, DATE, 510, 660, 10L)).contains(SlotProblem.TAKEN);
        assertThat(service.findProblem(LOCATION, COURT, DATE, 510, 600)).contains(SlotProblem.TAKEN);
    }

    @Test
    void approvedMaintenanceInsideRangeIsMaintenance() {
        when(maintenance.findByCourtIdInAndStatusAndStartAtLessThanAndEndAtGreaterThan(any(), any(), any(), any()))
                .thenReturn(List.of(Maintenance.builder().courtId(COURT).status(ApprovalStatus.APPROVED)
                        .startAt(DATE.atTime(10, 30)).endAt(DATE.atTime(11, 0)).build()));

        assertThat(problem(600, 660)).contains(SlotProblem.MAINTENANCE);
    }

    @Test
    void openingExceptionOverridesWeeklyHours() {
        when(exceptions.findByLocationIdAndExceptionDate(LOCATION, DATE)).thenReturn(Optional.of(
                OpeningException.builder().openMinute(480).closeMinute(720).build()));

        assertThat(service.openingWindow(LOCATION, DATE)).contains(new OpeningWindow(480, 720));
        assertThat(problem(360, 420)).as("giờ thường mở nhưng ngày ngoại lệ chưa mở").contains(SlotProblem.CLOSED);
        assertThat(problem(480, 540)).isEmpty();
    }

    @Test
    void openingWindowListsSlotStartsAndCoversOnlyInsideRange() {
        OpeningWindow window = new OpeningWindow(360, 480);

        assertThat(window.slotStarts()).containsExactly(360, 390, 420, 450);
        assertThat(window.covers(360, 480)).isTrue();
        assertThat(window.covers(330, 390)).isFalse();
        assertThat(window.covers(450, 510)).isFalse();
    }

    @Test
    void scheduleRangeSpansEarliestOpenAndLatestCloseOfTheWeek() {
        when(hours.findAllByLocationIdOrderByDayOfWeek(LOCATION)).thenReturn(List.of(
                OpeningHour.builder().dayOfWeek(1).openMinute(360).closeMinute(1320).build(),
                OpeningHour.builder().dayOfWeek(6).openMinute(300).closeMinute(1380).build()));

        assertThat(service.scheduleRange(LOCATION, DATE)).contains(new OpeningWindow(300, 1380));
    }

    @Test
    void scheduleRangeWidensForAnExceptionDay() {
        when(hours.findAllByLocationIdOrderByDayOfWeek(LOCATION)).thenReturn(List.of(
                OpeningHour.builder().dayOfWeek(1).openMinute(360).closeMinute(1320).build()));
        when(exceptions.findByLocationIdAndExceptionDate(LOCATION, DATE)).thenReturn(Optional.of(
                OpeningException.builder().openMinute(240).closeMinute(1410).build()));

        assertThat(service.scheduleRange(LOCATION, DATE)).contains(new OpeningWindow(240, 1410));
    }

    @Test
    void scheduleRangeIsEmptyWithoutAnyOpeningHours() {
        when(hours.findAllByLocationIdOrderByDayOfWeek(LOCATION)).thenReturn(List.of());
        when(hours.findByLocationIdAndDayOfWeek(any(), anyInt())).thenReturn(Optional.empty());

        assertThat(service.scheduleRange(LOCATION, DATE)).isEmpty();
    }

    @Test
    void bookedStartsAreGroupedByCourt() {
        when(slots.findByCourtIdInAndSlotDateAndActiveTrue(any(), any())).thenReturn(List.of(
                BookingSlot.builder().courtId(COURT).slotDate(DATE).slotStartMinute(600).build(),
                BookingSlot.builder().courtId(COURT).slotDate(DATE).slotStartMinute(630).build(),
                BookingSlot.builder().courtId(OTHER_COURT).slotDate(DATE).slotStartMinute(600).build()));

        Map<Long, Set<Integer>> booked = service.bookedStarts(List.of(COURT, OTHER_COURT), DATE);

        assertThat(booked.get(COURT)).containsExactlyInAnyOrder(600, 630);
        assertThat(booked.get(OTHER_COURT)).containsExactly(600);
    }

    @Test
    void noCourtsMeansNoSlotOrMaintenanceQuery() {
        assertThat(service.bookedStarts(List.of(), DATE)).isEmpty();
        assertThat(service.maintenanceStarts(List.of(), DATE)).isEmpty();
        verify(slots, never()).findByCourtIdInAndSlotDateAndActiveTrue(any(), any());
        verify(maintenance, never()).findByCourtIdInAndStatusAndStartAtLessThanAndEndAtGreaterThan(any(), any(), any(), any());
    }

    @Test
    void maintenanceSpanningMidnightOnlyBlocksThePartInsideTheDay() {
        when(maintenance.findByCourtIdInAndStatusAndStartAtLessThanAndEndAtGreaterThan(any(), any(), any(), any()))
                .thenReturn(List.of(
                        Maintenance.builder().courtId(COURT).status(ApprovalStatus.APPROVED)
                                .startAt(DATE.minusDays(1).atTime(20, 0)).endAt(DATE.atTime(1, 0)).build(),
                        Maintenance.builder().courtId(COURT).status(ApprovalStatus.APPROVED)
                                .startAt(DATE.atTime(23, 0)).endAt(DATE.plusDays(1).atTime(2, 0)).build()));

        assertThat(service.maintenanceStarts(List.of(COURT), DATE).get(COURT))
                .containsExactlyInAnyOrder(0, 30, 1380, 1410);
    }

    @Test
    void openingTimeNotExceededWhenThresholdHasNotPassedOrStartUnknown() {
        assertThat(service.exceededOpeningTime(LOCATION, null, DATE.atTime(12, 0), FIFTEEN_MINUTES)).isFalse();
        assertThat(service.exceededOpeningTime(LOCATION, DATE.atTime(10, 0), DATE.atTime(10, 15), FIFTEEN_MINUTES))
                .isFalse();
    }

    @Test
    void openingTimeExceededWithinOneOpenDay() {
        assertThat(service.exceededOpeningTime(LOCATION, DATE.atTime(10, 0), DATE.atTime(10, 16), FIFTEEN_MINUTES))
                .isTrue();
    }

    @Test
    void closedHoursOvernightAreNotCounted() {
        LocalDateTime sentLateEvening = DATE.atTime(21, 55);

        assertThat(service.exceededOpeningTime(LOCATION, sentLateEvening, DATE.plusDays(1).atTime(6, 5), FIFTEEN_MINUTES))
                .as("5 phút trước khi đóng cửa + 5 phút sau khi mở cửa").isFalse();
        assertThat(service.exceededOpeningTime(LOCATION, sentLateEvening, DATE.plusDays(1).atTime(6, 11), FIFTEEN_MINUTES))
                .isTrue();
    }

    @Test
    void closedDayInBetweenIsSkipped() {
        LocalDate closedDay = DATE.plusDays(1);
        when(hours.findByLocationIdAndDayOfWeek(LOCATION, closedDay.getDayOfWeek().getValue()))
                .thenReturn(Optional.empty());
        LocalDateTime sentLateEvening = DATE.atTime(21, 55);

        assertThat(service.exceededOpeningTime(LOCATION, sentLateEvening, DATE.plusDays(2).atTime(6, 9), FIFTEEN_MINUTES))
                .isFalse();
        assertThat(service.exceededOpeningTime(LOCATION, sentLateEvening, DATE.plusDays(2).atTime(6, 11), FIFTEEN_MINUTES))
                .isTrue();
    }

    @Test
    void courtWithoutPurchaseDatesIsAlwaysAvailable() {
        var court = com.sep490.bms.entity.location.Court.builder().id(COURT).locationId(LOCATION).build();

        assertThat(service.courtAvailableOn(court, DATE)).isTrue();
        verify(terms, never()).existsByLocationIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(any(), any(), any());
    }

    private Optional<SlotProblem> problem(int start, int end) {
        return service.findProblem(LOCATION, COURT, DATE, start, end);
    }
}
