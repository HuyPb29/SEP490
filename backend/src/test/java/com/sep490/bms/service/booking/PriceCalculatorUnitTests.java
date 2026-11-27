package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.sep490.bms.entity.location.PriceRule;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.PriceRuleRepository;

/**
 * Unit test thuần Mockito cho PriceCalculator (FR20, FR21, DR18).
 */
@ExtendWith(MockitoExtension.class)
class PriceCalculatorUnitTests {

    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 12, 2);
    private static final LocalDate SUNDAY = LocalDate.of(2026, 12, 6);

    @Mock
    private PriceRuleRepository priceRuleRepository;

    @InjectMocks
    private PriceCalculator priceCalculator;

    private static PriceRule rule(Long courtId, String applyDays, int startMinute, int endMinute, String price) {
        return PriceRule.builder()
                .courtId(courtId)
                .applyDays(applyDays)
                .startMinute(startMinute)
                .endMinute(endMinute)
                .pricePerSlot(new BigDecimal(price))
                .validFrom(WEDNESDAY.minusDays(10))
                .build();
    }

    // Kiểm tra ánh xạ đúng giá từng slot 30 phút cho nhiều sân theo quy tắc khớp thứ trong tuần.
    @Test
    void slotPrices_multipleCourtsAndValidWeekday_mapsEachHalfHourSlot() {
        // Arrange
        List<Long> courtIds = List.of(1L, 2L);
        PriceRule court1Morning = rule(1L, "1111100", 360, 420, "50000");
        PriceRule court2Evening = rule(2L, "1111100", 1080, 1140, "80000");
        when(priceRuleRepository.findValidOn(courtIds, WEDNESDAY)).thenReturn(List.of(court1Morning, court2Evening));

        // Act
        Map<Long, Map<Integer, BigDecimal>> result = priceCalculator.slotPrices(courtIds, WEDNESDAY);

        // Assert
        assertThat(result).containsOnlyKeys(1L, 2L);
        assertThat(result.get(1L)).hasSize(2)
                .containsEntry(360, new BigDecimal("50000"))
                .containsEntry(390, new BigDecimal("50000"));
        assertThat(result.get(2L)).hasSize(2)
                .containsEntry(1080, new BigDecimal("80000"))
                .containsEntry(1110, new BigDecimal("80000"));
    }

    // Kiểm tra biên danh sách sân rỗng trả về map rỗng ngay lập tức và không truy vấn DB.
    @Test
    void slotPrices_emptyCourtIds_returnsEmptyWithoutQueryingRepository() {
        // Arrange
        List<Long> courtIds = List.of();

        // Act
        Map<Long, Map<Integer, BigDecimal>> result = priceCalculator.slotPrices(courtIds, WEDNESDAY);

        // Assert
        assertThat(result).isEmpty();
        verifyNoInteractions(priceRuleRepository);
    }

    // Kiểm tra biên Chủ nhật (ký tự cuối cùng của apply_days) và khung sát 24:00 không tràn sang phút 1440.
    @Test
    void slotPrices_sundayMidnightRule_filtersNonMatchingDayAndStopsBefore1440() {
        // Arrange
        PriceRule nonSundayRule = rule(1L, "1111110", 360, 420, "50000");
        PriceRule sundayLateRule = rule(1L, "0000001", 1380, 1440, "90000");
        when(priceRuleRepository.findValidOn(List.of(1L), SUNDAY)).thenReturn(List.of(nonSundayRule, sundayLateRule));

        // Act
        Map<Long, Map<Integer, BigDecimal>> result = priceCalculator.slotPrices(List.of(1L), SUNDAY);

        // Assert
        assertThat(result).containsOnlyKeys(1L);
        assertThat(result.get(1L)).hasSize(2)
                .containsEntry(1380, new BigDecimal("90000"))
                .containsEntry(1410, new BigDecimal("90000"))
                .doesNotContainKeys(360, 1440);
    }

    // Kiểm tra trả về bảng giá từng slot theo đúng thứ tự thời gian khi khoảng đặt đi qua nhiều mức giá.
    @Test
    void rangePrices_acrossTwoPriceRules_preservesChronologicalOrder() {
        // Arrange
        PriceRule peakRule = rule(1L, "1111100", 1110, 1200, "80000");
        PriceRule normalRule = rule(1L, "1111100", 1020, 1110, "60000");
        when(priceRuleRepository.findValidOn(List.of(1L), WEDNESDAY)).thenReturn(List.of(peakRule, normalRule));

        // Act
        Map<Integer, BigDecimal> result = priceCalculator.rangePrices(1L, WEDNESDAY, 1080, 1170);

        // Assert
        assertThat(result.keySet()).containsExactly(1080, 1110, 1140);
        assertThat(result.values()).containsExactly(
                new BigDecimal("60000"),
                new BigDecimal("80000"),
                new BigDecimal("80000"));
    }

    // Kiểm tra báo lỗi 409 CONFLICT khi trong khoảng đặt có slot chưa được cấu hình giá (DR18).
    @Test
    void rangePrices_missingSlotPrice_throwsConflictAppException() {
        // Arrange
        PriceRule partialRule = rule(1L, "1111100", 540, 570, "55000");
        when(priceRuleRepository.findValidOn(List.of(1L), WEDNESDAY)).thenReturn(List.of(partialRule));

        // Act & Assert
        assertThatThrownBy(() -> priceCalculator.rangePrices(1L, WEDNESDAY, 540, 600))
                .isInstanceOfSatisfying(AppException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(ex.getMessage()).isEqualTo("Slot 09:30 chưa có giá");
                });
    }

    // Kiểm tra cộng dồn chính xác tổng tiền niêm yết của nhiều slot có đơn giá khác nhau.
    @Test
    void totalPrice_multipleSlotsAcrossRates_sumsAccurately() {
        // Arrange
        PriceRule normalRule = rule(1L, "1111100", 1020, 1110, "60000");
        PriceRule peakRule = rule(1L, "1111100", 1110, 1200, "80000");
        when(priceRuleRepository.findValidOn(List.of(1L), WEDNESDAY)).thenReturn(List.of(normalRule, peakRule));

        // Act
        BigDecimal total = priceCalculator.totalPrice(1L, WEDNESDAY, 1080, 1170);

        // Assert
        assertThat(total).isEqualByComparingTo("220000");
    }

    // Kiểm tra biên slot đầu ngày (00:00-00:30, độ dài tối thiểu 1 slot) tính đúng đơn giá.
    @Test
    void totalPrice_firstMidnightSingleSlot_returnsSingleSlotPrice() {
        // Arrange
        PriceRule earlyRule = rule(1L, "1111100", 0, 60, "45000");
        when(priceRuleRepository.findValidOn(List.of(1L), WEDNESDAY)).thenReturn(List.of(earlyRule));

        // Act
        BigDecimal total = priceCalculator.totalPrice(1L, WEDNESDAY, 0, 30);

        // Assert
        assertThat(total).isEqualByComparingTo("45000");
    }
}
