package com.sep490.bms.service.location;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.IntStream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.dto.location.CourtResponse;
import com.sep490.bms.dto.location.PriceRuleItem;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.PriceRule;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.PriceRuleRepository;

import lombok.RequiredArgsConstructor;

/**
 * Phần công khai của sân cho Guest và Player (UC12, FR30): danh sách sân đang bật, chi tiết sân kèm bảng giá.
 * Sân đã tắt hoặc thuộc địa điểm đã khóa không hiển thị (BR62).
 */
@Service
@RequiredArgsConstructor
public class CourtQueryService {

    private final CourtRepository courtRepository;
    private final PriceRuleRepository priceRuleRepository;
    private final LocationQueryService locationQueryService;

    /** UC12 #1: danh sách sân của địa điểm. */
    @Transactional(readOnly = true)
    public List<CourtResponse> listActive(Long locationId) {
        return activeCourts(locationId).stream().map(c -> toResponse(c, null)).toList();
    }

    /** UC12 #2: chi tiết sân và bảng giá còn hiệu lực hoặc sắp có hiệu lực. */
    @Transactional(readOnly = true)
    public CourtResponse detail(Long courtId) {
        Court court = courtRepository.findByIdAndActiveTrue(courtId)
                .orElseThrow(() -> new AppException("Không tìm thấy sân", HttpStatus.NOT_FOUND));
        locationQueryService.findActive(court.getLocationId());

        List<PriceRuleItem> priceRules = priceRuleRepository.findNotExpired(courtId, LocalDate.now()).stream()
                .map(CourtQueryService::toItem)
                .toList();
        return toResponse(court, priceRules);
    }

    /** Sân đang bật của một địa điểm đang hoạt động. Service khác của F3 dùng lại. */
    @Transactional(readOnly = true)
    public List<Court> activeCourts(Long locationId) {
        locationQueryService.findActive(locationId);
        return courtRepository.findAllByLocationIdAndActiveTrueOrderById(locationId);
    }

    private static CourtResponse toResponse(Court court, List<PriceRuleItem> priceRules) {
        return CourtResponse.builder()
                .id(court.getId())
                .locationId(court.getLocationId())
                .name(court.getName())
                .description(court.getDescription())
                .priceRules(priceRules)
                .build();
    }

    private static PriceRuleItem toItem(PriceRule rule) {
        return PriceRuleItem.builder()
                .applyDays(applyDays(rule.getApplyDays()))
                .startTime(MinuteTime.format(rule.getStartMinute()))
                .endTime(MinuteTime.format(rule.getEndMinute()))
                .pricePerSlot(rule.getPricePerSlot())
                .validFrom(rule.getValidFrom())
                .validTo(rule.getValidTo())
                .build();
    }

    /** "1111100" → [1, 2, 3, 4, 5]: ký tự thứ 1 là thứ Hai … ký tự thứ 7 là Chủ nhật. */
    private static List<Integer> applyDays(String days) {
        return IntStream.rangeClosed(1, 7).filter(d -> days.charAt(d - 1) == '1').boxed().toList();
    }
}
