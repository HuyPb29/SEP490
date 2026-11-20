package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.sep490.bms.entity.booking.BookingSlot;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.Maintenance;
import com.sep490.bms.entity.location.OpeningHour;
import com.sep490.bms.repository.booking.BookingSlotRepository;
import com.sep490.bms.repository.location.MaintenanceRepository;
import com.sep490.bms.repository.location.OpeningExceptionRepository;
import com.sep490.bms.repository.location.OpeningHourRepository;
import com.sep490.bms.service.booking.SlotAvailabilityService.SlotProblem;

/**
 * Kiểm tra slot trống, slot đã giữ, lịch bảo trì và khung giờ ngoài giờ mở cửa.
 */
class SlotAvailabilityServiceTests {

    private static final Long LOCATION = 1L;
    private static final Long COURT = 5L;
    private static final LocalDate DATE = LocalDate.of(2026, 11, 2);

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

    private Optional<SlotProblem> problem(int start, int end) {
        return service.findProblem(LOCATION, COURT, DATE, start, end);
    }
}
