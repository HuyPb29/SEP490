package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.sep490.bms.dto.location.LocationSummaryResponse;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.location.OpeningHour;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.location.OpeningHourRepository;
import com.sep490.bms.service.location.LocationQueryService;

class LocationQueryServiceTests {

    private final LocationRepository locations = mock(LocationRepository.class);
    private final OpeningHourRepository openingHours = mock(OpeningHourRepository.class);
    private final LocationQueryService service = new LocationQueryService(locations, openingHours);

    // Hồ Gươm (21.0285, 105.8542); Linh Đàm cách ~8 km, Long Biên cách ~3 km
    private final Location linhDam = location(1L, "Sân Linh Đàm", "20.966100", "105.828900");
    private final Location longBien = location(2L, "Sân Long Biên", "21.040000", "105.880000");

    @Test
    void withoutPositionKeepsNameOrderAndHasNoDistance() {
        when(locations.searchActive(null)).thenReturn(List.of(linhDam, longBien));

        List<LocationSummaryResponse> result = service.search(null, null, null);

        assertThat(result).extracting(LocationSummaryResponse::getId).containsExactly(1L, 2L);
        assertThat(result).allMatch(r -> r.getDistanceKm() == null);
    }

    @Test
    void withPositionSortsNearToFar() {
        when(locations.searchActive(null)).thenReturn(List.of(linhDam, longBien));

        List<LocationSummaryResponse> result = service.search(" ", 21.0285, 105.8542);

        assertThat(result).extracting(LocationSummaryResponse::getId).containsExactly(2L, 1L);
        assertThat(result.get(0).getDistanceKm()).isBetween(2.0, 4.0);
        assertThat(result.get(1).getDistanceKm()).isBetween(6.0, 9.0);
    }

    @Test
    void keywordIsTrimmedAndLikeWildcardsAreEscaped() {
        service.search("  50%_sân[1] ", null, null);

        verify(locations).searchActive("%50[%][_]sân[[]1]%");
    }

    @Test
    void positionMustHaveBothLatAndLngInRange() {
        assertThatThrownBy(() -> service.search(null, 21.0, null)).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.search(null, 91.0, 105.0)).isInstanceOf(AppException.class);
        verifyNoInteractions(locations);
    }

    @Test
    void notANumberPositionIsRejected() {
        when(locations.searchActive(null)).thenReturn(List.of(linhDam));

        assertThatThrownBy(() -> service.search(null, Double.NaN, 105.0)).isInstanceOf(AppException.class);
    }

    @Test
    void detailReturnsOpeningHoursAsHhMm() {
        when(locations.findByIdAndStatus(1L, "ACTIVE")).thenReturn(Optional.of(linhDam));
        when(openingHours.findAllByLocationIdOrderByDayOfWeek(1L)).thenReturn(List.of(
                OpeningHour.builder().locationId(1L).dayOfWeek(1).openMinute(360).closeMinute(1440).build()));

        var detail = service.detail(1L);

        assertThat(detail.getContactPhone()).isEqualTo("0987654321");
        assertThat(detail.getOpeningHours()).singleElement().satisfies(h -> {
            assertThat(h.getOpenTime()).isEqualTo("06:00");
            assertThat(h.getCloseTime()).isEqualTo("24:00");
        });
    }

    @Test
    void lockedOrMissingLocationIsNotFound() {
        when(locations.findByIdAndStatus(9L, "ACTIVE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.detail(9L))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    private static Location location(Long id, String name, String lat, String lng) {
        return Location.builder().id(id).ownerId(10L).name(name).address(name + ", Hà Nội")
                .latitude(new BigDecimal(lat)).longitude(new BigDecimal(lng))
                .contactPhone("0987654321").build();
    }
}
