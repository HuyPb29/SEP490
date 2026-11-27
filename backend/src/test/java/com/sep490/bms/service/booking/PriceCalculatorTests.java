package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.sep490.bms.entity.location.PriceRule;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.PriceRuleRepository;

/**
 * Giá niêm yết từng slot theo price_rule (FR20, FR21): đúng sân, đúng thứ trong apply_days, slot nằm trong
 * khung giờ của mức giá; khoảng có slot chưa có giá thì báo lỗi dữ liệu thay vì tính thiếu tiền.
 */
class PriceCalculatorTests {

    private static final Long COURT_A = 5L;
    private static final Long COURT_B = 6L;
    /** 02/11/2026 là thứ Hai. */
    private static final LocalDate MONDAY = LocalDate.of(2026, 11, 2);
    private static final LocalDate SUNDAY = LocalDate.of(2026, 11, 8);
    private static final String EVERY_DAY = "1111111";
    private static final String WEEKEND = "0000011";

    private final PriceRuleRepository rules = mock(PriceRuleRepository.class);
    private final PriceCalculator calculator = new PriceCalculator(rules);

    @Test
    void eachSlotInsideRuleGetsRulePrice() {
        when(rules.findValidOn(anyCollection(), any())).thenReturn(List.of(
                rule(COURT_A, EVERY_DAY, 360, 480, "60000")));

        Map<Integer, BigDecimal> prices = calculator.slotPrices(List.of(COURT_A), MONDAY).get(COURT_A);

        assertThat(prices).containsOnlyKeys(360, 390, 420, 450);
        assertThat(prices.values()).allMatch(price -> price.compareTo(new BigDecimal("60000")) == 0);
    }

    @Test
    void ruleNotApplyingOnThatWeekdayIsSkipped() {
        when(rules.findValidOn(anyCollection(), any())).thenReturn(List.of(
                rule(COURT_A, EVERY_DAY, 360, 420, "60000"),
                rule(COURT_A, WEEKEND, 420, 480, "90000")));

        assertThat(calculator.slotPrices(List.of(COURT_A), MONDAY).get(COURT_A))
                .as("thứ Hai không lấy mức giá cuối tuần").containsOnlyKeys(360, 390);
        assertThat(calculator.slotPrices(List.of(COURT_A), SUNDAY).get(COURT_A))
                .containsOnlyKeys(360, 390, 420, 450)
                .containsEntry(420, new BigDecimal("90000"));
    }

    @Test
    void pricesAreKeptPerCourt() {
        when(rules.findValidOn(anyCollection(), any())).thenReturn(List.of(
                rule(COURT_A, EVERY_DAY, 360, 420, "60000"),
                rule(COURT_B, EVERY_DAY, 360, 390, "80000")));

        Map<Long, Map<Integer, BigDecimal>> prices = calculator.slotPrices(List.of(COURT_A, COURT_B), MONDAY);

        assertThat(prices.get(COURT_A)).containsOnlyKeys(360, 390);
        assertThat(prices.get(COURT_B)).containsOnlyKeys(360).containsEntry(360, new BigDecimal("80000"));
    }

    @Test
    void noCourtsMeansNoQuery() {
        assertThat(calculator.slotPrices(List.of(), MONDAY)).isEmpty();
        verify(rules, never()).findValidOn(anyCollection(), any());
    }

    @Test
    void rangePricesFollowTimeOrderAcrossTwoRules() {
        when(rules.findValidOn(anyCollection(), any())).thenReturn(List.of(
                rule(COURT_A, EVERY_DAY, 1020, 1080, "120000"),
                rule(COURT_A, EVERY_DAY, 960, 1020, "80000")));

        Map<Integer, BigDecimal> prices = calculator.rangePrices(COURT_A, MONDAY, 990, 1050);

        assertThat(prices.keySet()).containsExactly(990, 1020);
        assertThat(prices.get(990)).isEqualByComparingTo("80000");
        assertThat(prices.get(1020)).isEqualByComparingTo("120000");
    }

    @Test
    void slotWithoutPriceIsDataConflict() {
        when(rules.findValidOn(anyCollection(), any())).thenReturn(List.of(
                rule(COURT_A, EVERY_DAY, 600, 630, "60000")));

        assertThatThrownBy(() -> calculator.rangePrices(COURT_A, MONDAY, 600, 660))
                .isInstanceOf(AppException.class)
                .hasMessage("Slot 10:30 chưa có giá")
                .extracting(e -> ((AppException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void totalPriceAddsEverySlotOfTheRange() {
        when(rules.findValidOn(anyCollection(), any())).thenReturn(List.of(
                rule(COURT_A, EVERY_DAY, 960, 1020, "80000"),
                rule(COURT_A, EVERY_DAY, 1020, 1080, "120000")));

        assertThat(calculator.totalPrice(COURT_A, MONDAY, 960, 1080)).isEqualByComparingTo("400000");
        assertThat(calculator.totalPrice(COURT_A, MONDAY, 960, 990)).isEqualByComparingTo("80000");
    }

    @Test
    void applyDaysStartsOnMondayAndEndsOnSunday() {
        assertThat(PriceCalculator.appliesOn(rule(COURT_A, "1000000", 0, 30, "1"), MONDAY)).isTrue();
        assertThat(PriceCalculator.appliesOn(rule(COURT_A, "1000000", 0, 30, "1"), SUNDAY)).isFalse();
        assertThat(PriceCalculator.appliesOn(rule(COURT_A, "0000001", 0, 30, "1"), SUNDAY)).isTrue();
    }

    private static PriceRule rule(Long courtId, String applyDays, int start, int end, String price) {
        return PriceRule.builder().courtId(courtId).applyDays(applyDays)
                .startMinute(start).endMinute(end).pricePerSlot(new BigDecimal(price)).build();
    }
}
