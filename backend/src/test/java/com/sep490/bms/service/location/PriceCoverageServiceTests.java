package com.sep490.bms.service.location;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.IntStream;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.*;
import org.junit.jupiter.api.Test;

class PriceCoverageServiceTests {
    @Test void purchasedCourtRequiresPricesOnlyForItsPaidDatesAndRecordedRenewals() {
        var courts = mock(CourtRepository.class);
        var hours = mock(OpeningHourRepository.class);
        var exceptions = mock(OpeningExceptionRepository.class);
        var prices = mock(PriceRuleRepository.class);
        var terms = mock(ServiceTermRepository.class);
        var service = new PriceCoverageService(courts, hours, exceptions, prices, terms);
        var tomorrow = LocalDate.now().plusDays(1);
        var location = Location.builder().id(1L).build();
        var court = Court.builder().id(2L).locationId(1L).availableFrom(tomorrow).availableUntil(tomorrow).build();
        when(hours.findAllByLocationIdOrderByDayOfWeekAsc(1L)).thenReturn(IntStream.rangeClosed(1,7)
                .mapToObj(day -> OpeningHour.builder().dayOfWeek(day).openMinute(540).closeMinute(600).build()).toList());
        when(prices.findAllByCourtIdOrderByStartMinuteAsc(2L)).thenReturn(List.of(PriceRule.builder()
                .applyDays("1111111").startMinute(540).endMinute(600).validFrom(tomorrow).validTo(tomorrow).build()));
        assertThatCode(() -> service.requireCourtCoverage(location, court)).doesNotThrowAnyException();
        when(terms.findAllByLocationId(1L)).thenReturn(List.of(ServiceTerm.builder()
                .startDate(tomorrow.plusDays(1)).endDate(tomorrow.plusYears(1)).build()));
        assertThatThrownBy(() -> service.requireCourtCoverage(location, court)).isInstanceOf(AppException.class)
                .hasMessageContaining("chưa có giá");
    }
}
