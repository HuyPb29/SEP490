package com.sep490.bms.service.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.entity.location.PriceRule;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.PriceRuleRepository;

import lombok.RequiredArgsConstructor;

/**
 * Giá niêm yết của từng slot theo price_rule (FR20, FR21): đúng sân, đúng thứ trong {@code apply_days},
 * slot nằm trong khung giờ của mức giá, ngày nằm trong thời gian áp dụng.
 * Mức giá không chồng nhau (DR18) nên mỗi slot khớp nhiều nhất một mức.
 */
@Service
@RequiredArgsConstructor
public class PriceCalculator {

    private final PriceRuleRepository priceRuleRepository;

    /** Sân → (phút bắt đầu slot → giá). Slot không có trong map là slot chưa có giá. */
    @Transactional(readOnly = true)
    public Map<Long, Map<Integer, BigDecimal>> slotPrices(Collection<Long> courtIds, LocalDate date) {
        Map<Long, Map<Integer, BigDecimal>> result = new HashMap<>();
        if (courtIds.isEmpty()) return result;
        for (PriceRule rule : priceRuleRepository.findValidOn(courtIds, date)) {
            if (!appliesOn(rule, date)) continue;
            Map<Integer, BigDecimal> prices = result.computeIfAbsent(rule.getCourtId(), k -> new HashMap<>());
            for (int s = rule.getStartMinute(); s < rule.getEndMinute(); s += MinuteTime.SLOT_MINUTES) {
                prices.put(s, rule.getPricePerSlot());
            }
        }
        return result;
    }

    /** Tổng giá niêm yết của khoảng [startMinute, endMinute) trên một sân. */
    @Transactional(readOnly = true)
    public BigDecimal totalPrice(Long courtId, LocalDate date, int startMinute, int endMinute) {
        Map<Integer, BigDecimal> prices = slotPrices(List.of(courtId), date).getOrDefault(courtId, Map.of());
        BigDecimal total = BigDecimal.ZERO;
        for (int s = startMinute; s < endMinute; s += MinuteTime.SLOT_MINUTES) {
            BigDecimal price = prices.get(s);
            if (price == null) {
                // Không xảy ra nếu Owner đã cài giá phủ kín giờ mở cửa (DR18, MSG42); gặp thì là lỗi dữ liệu.
                throw new AppException("Slot " + MinuteTime.format(s) + " chưa có giá", HttpStatus.CONFLICT);
            }
            total = total.add(price);
        }
        return total;
    }

    /** apply_days: ký tự thứ 1 là thứ Hai … ký tự thứ 7 là Chủ nhật; '1' = áp dụng. */
    static boolean appliesOn(PriceRule rule, LocalDate date) {
        return rule.getApplyDays().charAt(date.getDayOfWeek().getValue() - 1) == '1';
    }
}
