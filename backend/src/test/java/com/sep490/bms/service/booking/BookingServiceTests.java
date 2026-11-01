package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
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
import org.springframework.http.HttpStatus;

import com.sep490.bms.dto.booking.BookingSummaryResponse;
import com.sep490.bms.dto.request.BookingRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.SlotAvailabilityService.SlotProblem;
import com.sep490.bms.service.location.LocationQueryService;

class BookingServiceTests {

    private static final Long LOCATION = 1L;
    private static final Long COURT = 5L;
    private static final Long PLAYER = 7L;
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 30);
    /** Hôm nay 12:10, giữa slot 12:00. */
    private static final LocalDateTime NOW = TODAY.atTime(12, 10);
    private static final LocalDate PLAY_DATE = TODAY.plusDays(3);
    /** 18:00–19:00: hai slot, giá khác nhau để thấy tổng tiền cộng từng slot. */
    private static final int START = 1080;

    private final CourtRepository courts = mock(CourtRepository.class);
    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final SlotAvailabilityService availability = mock(SlotAvailabilityService.class);
    private final PriceCalculator prices = mock(PriceCalculator.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final BookingService service = new BookingService(courts, locations, availability, prices, accounts);

    private final UserPrincipal player = UserPrincipal.builder().id(PLAYER).role(Role.PLAYER).build();

    @BeforeEach
    void defaults() {
        when(courts.findByIdAndActiveTrue(COURT)).thenReturn(Optional.of(
                Court.builder().id(COURT).locationId(LOCATION).name("Sân 1").build()));
        when(locations.findActive(LOCATION)).thenReturn(
                Location.builder().id(LOCATION).name("Cầu lông Sunrise").advanceBookingDays((short) 30).build());
        when(accounts.findById(PLAYER)).thenReturn(Optional.of(
                Account.builder().id(PLAYER).fullName("Nguyễn An").phone("0912345678").build()));
        Map<Integer, BigDecimal> slotPrices = new LinkedHashMap<>();
        slotPrices.put(1080, new BigDecimal("60000"));
        slotPrices.put(1110, new BigDecimal("70000"));
        when(prices.rangePrices(eq(COURT), any(), anyInt(), anyInt())).thenReturn(slotPrices);
        when(availability.findProblem(any(), any(), any(), anyInt(), anyInt())).thenReturn(Optional.empty());
    }

    @Test
    void summaryAddsUpListPriceOfEachSlot() {
        BookingSummaryResponse summary = service.previewSummary(player, request(), NOW);

        assertThat(summary.getListAmount()).isEqualByComparingTo("130000");
        assertThat(summary.getFinalAmount()).isEqualByComparingTo("130000");
        assertThat(summary.getVoucherDiscount()).isEqualByComparingTo("0");
        assertThat(summary.getPointDiscount()).isEqualByComparingTo("0");
        assertThat(summary.getSlots()).extracting(BookingSummaryResponse.SlotPrice::getTime)
                .containsExactly("18:00", "18:30");
    }

    @Test
    void summaryShowsLocationCourtAndBooker() {
        BookingSummaryResponse summary = service.previewSummary(player, request(), NOW);

        assertThat(summary.getLocationName()).isEqualTo("Cầu lông Sunrise");
        assertThat(summary.getCourtName()).isEqualTo("Sân 1");
        assertThat(summary.getStartTime()).isEqualTo("18:00");
        assertThat(summary.getEndTime()).isEqualTo("19:00");
        assertThat(summary.getBookerName()).isEqualTo("Nguyễn An");
        assertThat(summary.getBookerPhone()).isEqualTo("0912345678");
    }

    @Test
    void courtTurnedOffIsNotFound() {
        when(courts.findByIdAndActiveTrue(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.previewSummary(player, request(), NOW))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void slotAlreadyHeldIsConflictMsg28() {
        problem(SlotProblem.TAKEN);

        assertThatThrownBy(() -> service.previewSummary(player, request(), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getMessage()).contains("MSG28");
                });
    }

    @Test
    void closedOrMaintenanceSlotIsMsg31() {
        for (SlotProblem reason : List.of(SlotProblem.CLOSED, SlotProblem.MAINTENANCE)) {
            problem(reason);

            assertNotBookable(request());
        }
    }

    @Test
    void dateAtAdvanceLimitIsAllowedButOneDayLaterIsMsg31() {
        LocalDate limit = TODAY.plusDays(30);

        assertThat(service.previewSummary(player, requestOn(limit, START), NOW).getDate()).isEqualTo(limit);
        assertNotBookable(requestOn(limit.plusDays(1), START));
    }

    @Test
    void pastDateIsMsg31() {
        assertNotBookable(requestOn(TODAY.minusDays(1), START));
    }

    @Test
    void slotThatAlreadyStartedTodayIsMsg31() {
        assertNotBookable(requestOn(TODAY, 720));
        assertThat(service.previewSummary(player, requestOn(TODAY, 750), NOW).getDate()).isEqualTo(TODAY);
    }

    private void assertNotBookable(BookingRequest request) {
        assertThatThrownBy(() -> service.previewSummary(player, request, NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getMessage()).contains("MSG31").contains("30 ngày");
                });
    }

    private void problem(SlotProblem reason) {
        when(availability.findProblem(any(), any(), any(), anyInt(), anyInt())).thenReturn(Optional.of(reason));
    }

    private static BookingRequest request() {
        return requestOn(PLAY_DATE, START);
    }

    private static BookingRequest requestOn(LocalDate date, int startMinute) {
        return new BookingRequest(COURT, date, startMinute, startMinute + 60, null, null, 0);
    }
}
