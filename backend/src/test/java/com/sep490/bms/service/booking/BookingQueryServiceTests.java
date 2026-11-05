package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.booking.BookingListItem;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.BookingType;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.LocationQueryService;

/** UC17: Player xem lịch sử booking của mình. */
class BookingQueryServiceTests {

    private static final Long PLAYER = 7L;
    private static final Long LOCATION = 1L;
    private static final Long COURT = 11L;
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 5, 18, 0);

    private final BookingRepository bookings = mock(BookingRepository.class);
    private final CourtRepository courts = mock(CourtRepository.class);
    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final BookingQueryService service = new BookingQueryService(bookings, courts, locations);

    private final UserPrincipal player = UserPrincipal.builder().id(PLAYER).role(Role.PLAYER).build();

    @BeforeEach
    void defaults() {
        // Địa điểm đã khóa vẫn có tên trong lịch sử
        when(locations.getByIds(any())).thenReturn(Map.of(LOCATION,
                Location.builder().id(LOCATION).name("Sân Linh Đàm").status("LOCKED").build()));
        when(courts.findAllById(any())).thenReturn(List.of(Court.builder().id(COURT).name("Sân 1").build()));
    }

    private static Booking booking(Long id, BookingStatus status, LocalDateTime holdExpiresAt) {
        return Booking.builder()
                .id(id)
                .bookingCode("BK" + id)
                .bookingType(BookingType.SINGLE)
                .locationId(LOCATION)
                .courtId(COURT)
                .playerId(PLAYER)
                .playDate(LocalDate.of(2026, 11, 8))
                .startMinute(1080)
                .endMinute(1440)
                .finalAmount(new BigDecimal("150000"))
                .status(status)
                .holdExpiresAt(holdExpiresAt)
                .createdAt(NOW.minusMinutes(2))
                .build();
    }

    private void repositoryReturns(Booking... rows) {
        when(bookings.findPlayerBookings(eq(PLAYER), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(rows), PageRequest.of(0, 20), rows.length));
    }

    @Test
    void listMyBookings_mapsNamesAndTimes() {
        repositoryReturns(booking(1L, BookingStatus.CONFIRMED, NOW.minusMinutes(10)));

        PageResponse<BookingListItem> page = service.listMyBookings(player, null, 0, 20, NOW);

        BookingListItem item = page.getContent().get(0);
        assertThat(item.getBookingCode()).isEqualTo("BK1");
        assertThat(item.getLocationName()).isEqualTo("Sân Linh Đàm");
        assertThat(item.getCourtName()).isEqualTo("Sân 1");
        assertThat(item.getStartTime()).isEqualTo("18:00");
        assertThat(item.getEndTime()).isEqualTo("24:00");
        assertThat(item.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(item.getHoldExpiresAt()).isNull();
        assertThat(page.getTotalElements()).isEqualTo(1);
    }

    @Test
    void listMyBookings_onlyAsksForOwnBookingsWithFilterAndClock() {
        repositoryReturns();

        service.listMyBookings(player, BookingStatus.PAYMENT_REJECTED, 2, 5, NOW);

        verify(bookings).findPlayerBookings(PLAYER, BookingStatus.PAYMENT_REJECTED, NOW, PageRequest.of(2, 5));
    }

    @Test
    void listMyBookings_holdingStillValid_showsCountdown() {
        repositoryReturns(booking(1L, BookingStatus.HOLDING, NOW.plusMinutes(3)));

        BookingListItem item = service.listMyBookings(player, null, 0, 20, NOW).getContent().get(0);

        assertThat(item.getStatus()).isEqualTo(BookingStatus.HOLDING);
        assertThat(item.getHoldExpiresAt()).isEqualTo(NOW.plusMinutes(3));
    }

    @Test
    void listMyBookings_holdingPastDeadline_showsExpiredWithoutCountdown() {
        // Job UC37 chưa chạy nên database vẫn là HOLDING
        repositoryReturns(booking(1L, BookingStatus.HOLDING, NOW));

        BookingListItem item = service.listMyBookings(player, null, 0, 20, NOW).getContent().get(0);

        assertThat(item.getStatus()).isEqualTo(BookingStatus.EXPIRED);
        assertThat(item.getHoldExpiresAt()).isNull();
    }

    @Test
    void listMyBookings_invalidPaging_rejected() {
        for (int[] bad : new int[][] { { -1, 20 }, { 0, 0 }, { 0, 101 } }) {
            assertThatThrownBy(() -> service.listMyBookings(player, null, bad[0], bad[1], NOW))
                    .isInstanceOf(AppException.class)
                    .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
        }
        verifyNoInteractions(bookings);
    }

    @Test
    void shownStatus_onlyChangesExpiredHolding() {
        assertThat(BookingQueryService.shownStatus(BookingStatus.HOLDING, NOW.plusSeconds(1), NOW))
                .isEqualTo(BookingStatus.HOLDING);
        assertThat(BookingQueryService.shownStatus(BookingStatus.HOLDING, NOW, NOW))
                .isEqualTo(BookingStatus.EXPIRED);
        assertThat(BookingQueryService.shownStatus(BookingStatus.HOLDING, null, NOW))
                .isEqualTo(BookingStatus.HOLDING);
        assertThat(BookingQueryService.shownStatus(BookingStatus.AWAITING_CONFIRMATION, NOW.minusDays(1), NOW))
                .isEqualTo(BookingStatus.AWAITING_CONFIRMATION);
    }
}
