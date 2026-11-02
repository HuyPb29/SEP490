package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.sep490.bms.dto.location.CourtResponse;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.PriceRule;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.PriceRuleRepository;
import com.sep490.bms.service.location.CourtQueryService;
import com.sep490.bms.service.location.LocationQueryService;

class CourtQueryServiceTests {

    private final CourtRepository courts = mock(CourtRepository.class);
    private final PriceRuleRepository priceRules = mock(PriceRuleRepository.class);
    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final CourtQueryService service = new CourtQueryService(courts, priceRules, locations);

    private final Court court = Court.builder().id(5L).locationId(1L).name("Sân 1").active(true).build();

    @Test
    void listHasActiveCourtsWithoutPriceTable() {
        when(courts.findAllByLocationIdAndActiveTrueOrderById(1L)).thenReturn(List.of(court));

        List<CourtResponse> result = service.listActive(1L);

        assertThat(result).singleElement().satisfies(c -> {
            assertThat(c.getName()).isEqualTo("Sân 1");
            assertThat(c.getPriceRules()).isNull();
        });
        verifyNoInteractions(priceRules);
    }

    @Test
    void listOfLockedLocationIsNotFound() {
        when(locations.findActive(9L)).thenThrow(new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> service.listActive(9L)).isInstanceOf(AppException.class);
        verifyNoInteractions(courts);
    }

    @Test
    void detailReturnsPriceTableInReadableForm() {
        when(courts.findByIdAndActiveTrue(5L)).thenReturn(Optional.of(court));
        when(priceRules.findNotExpired(eq(5L), any())).thenReturn(List.of(PriceRule.builder()
                .courtId(5L).applyDays("1111100").startMinute(960).endMinute(1440)
                .pricePerSlot(new BigDecimal("60000")).validFrom(LocalDate.of(2026, 1, 1)).build()));

        CourtResponse detail = service.detail(5L);

        assertThat(detail.getPriceRules()).singleElement().satisfies(p -> {
            assertThat(p.getApplyDays()).containsExactly(1, 2, 3, 4, 5);
            assertThat(p.getStartTime()).isEqualTo("16:00");
            assertThat(p.getEndTime()).isEqualTo("24:00");
            assertThat(p.getPricePerSlot()).isEqualByComparingTo("60000");
            assertThat(p.getValidTo()).isNull();
        });
    }

    @Test
    void disabledOrMissingCourtIsNotFound() {
        when(courts.findByIdAndActiveTrue(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.detail(9L))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void courtOfLockedLocationIsNotFound() {
        when(courts.findByIdAndActiveTrue(5L)).thenReturn(Optional.of(court));
        when(locations.findActive(1L)).thenThrow(new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> service.detail(5L)).isInstanceOf(AppException.class);
        verifyNoInteractions(priceRules);
    }
}
