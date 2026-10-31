package com.sep490.bms.service.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.ApplyDays;
import com.sep490.bms.dto.location.CreatePriceRuleRequest;
import com.sep490.bms.dto.location.OpeningTime;
import com.sep490.bms.dto.location.PriceRuleDto;
import com.sep490.bms.dto.location.UpdatePriceRuleRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.PriceRule;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.PriceRuleRepository;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC09 - Quản lý bảng giá theo sân (FR19).
 *
 * Mỗi dòng giá là một khoảng [start_minute, end_minute) áp cho một tập thứ trong tuần
 * và một khoảng ngày hiệu lực. Service chặn các dòng giá chồng lấn nhau trên cùng một sân
 * để F3 luôn tra được đúng một mức giá cho mỗi slot.
 */
@Service
@RequiredArgsConstructor
public class PriceRuleService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String START_LABEL = "Giờ bắt đầu";
    private static final String END_LABEL = "Giờ kết thúc";

    private final PriceRuleRepository priceRuleRepository;
    private final CourtManagementService courtManagementService;
    private final LocationManagementService locationManagementService;

    /** UC09 - Owner xem bảng giá của một sân thuộc địa điểm mình sở hữu. */
    @Transactional(readOnly = true)
    public List<PriceRuleDto> list(UserPrincipal user, Long courtId) {
        Court court = courtManagementService.requireCourt(courtId);
        locationManagementService.ownedLocation(user, court.getLocationId());
        return rulesOf(court.getId()).stream()
                .map(rule -> PriceRuleDto.fromEntity(rule, court.getName()))
                .toList();
    }

    /** UC09 - Owner thêm một dòng giá cho sân. */
    @Transactional
    public PriceRuleDto create(UserPrincipal user, Long courtId, CreatePriceRuleRequest request) {
        Court court = courtManagementService.requireCourt(courtId);
        Location location = locationManagementService.ownedLocation(user, court.getLocationId());
        requireActiveLocation(location);

        String mask = ApplyDays.toMask(request.getDays());
        int start = resolveMinute(request.getStartMinute(), request.getStartTime(), START_LABEL);
        int end = resolveMinute(request.getEndMinute(), request.getEndTime(), END_LABEL);
        OpeningWindowValidator.validateWindow(start, end, START_LABEL, END_LABEL);
        BigDecimal price = requirePrice(request.getPricePerSlot());
        LocalDate validFrom = requireValidFrom(request.getValidFrom());
        LocalDate validTo = request.getValidTo();
        ensureValidRange(validFrom, validTo);

        ensureNoOverlap(court.getId(), mask, start, end, validFrom, validTo, null);

        PriceRule entity = PriceRule.builder()
                .courtId(court.getId())
                .applyDays(mask)
                .startMinute(start)
                .endMinute(end)
                .pricePerSlot(price)
                .validFrom(validFrom)
                .validTo(validTo)
                .build();
        return PriceRuleDto.fromEntity(priceRuleRepository.save(entity), court.getName());
    }

    /** UC09 - Owner sửa một dòng giá. Trường null nghĩa là giữ nguyên. */
    @Transactional
    public PriceRuleDto update(UserPrincipal user, Long priceRuleId, UpdatePriceRuleRequest request) {
        PriceRule entity = requireRule(priceRuleId);
        Court court = courtManagementService.requireCourt(entity.getCourtId());
        Location location = locationManagementService.ownedLocation(user, court.getLocationId());
        requireActiveLocation(location);

        String mask = request.getDays() == null ? entity.getApplyDays() : ApplyDays.toMask(request.getDays());

        boolean startSent = request.getStartMinute() != null || !isBlank(request.getStartTime());
        boolean endSent = request.getEndMinute() != null || !isBlank(request.getEndTime());
        int start = startSent
                ? resolveMinute(request.getStartMinute(), request.getStartTime(), START_LABEL)
                : entity.getStartMinute();
        int end = endSent
                ? resolveMinute(request.getEndMinute(), request.getEndTime(), END_LABEL)
                : entity.getEndMinute();
        OpeningWindowValidator.validateWindow(start, end, START_LABEL, END_LABEL);

        BigDecimal price = request.getPricePerSlot() == null
                ? entity.getPricePerSlot()
                : requirePrice(request.getPricePerSlot());
        LocalDate validFrom = request.getValidFrom() == null ? entity.getValidFrom() : request.getValidFrom();
        LocalDate validTo = request.getValidTo() == null ? entity.getValidTo() : request.getValidTo();
        ensureValidRange(validFrom, validTo);

        ensureNoOverlap(court.getId(), mask, start, end, validFrom, validTo, entity.getId());

        entity.setApplyDays(mask);
        entity.setStartMinute(start);
        entity.setEndMinute(end);
        entity.setPricePerSlot(price);
        entity.setValidFrom(validFrom);
        entity.setValidTo(validTo);
        return PriceRuleDto.fromEntity(priceRuleRepository.save(entity), court.getName());
    }

    /** UC09 - Owner xoá một dòng giá. booking không tham chiếu price_rule nên xoá cứng được. */
    @Transactional
    public void delete(UserPrincipal user, Long priceRuleId) {
        PriceRule entity = requireRule(priceRuleId);
        Court court = courtManagementService.requireCourt(entity.getCourtId());
        Location location = locationManagementService.ownedLocation(user, court.getLocationId());
        requireActiveLocation(location);
        priceRuleRepository.delete(entity);
    }

    // --------------------------------------------------------------- helpers

    private List<PriceRule> rulesOf(Long courtId) {
        return priceRuleRepository.findAllByCourtIdOrderByStartMinuteAsc(courtId);
    }

    private PriceRule requireRule(Long priceRuleId) {
        if (priceRuleId == null || priceRuleId <= 0) {
            throw new AppException("Mã quy tắc giá không hợp lệ");
        }
        return priceRuleRepository.findById(priceRuleId)
                .orElseThrow(() -> new AppException("Không tìm thấy quy tắc giá", HttpStatus.NOT_FOUND));
    }

    private void requireActiveLocation(Location location) {
        if (!STATUS_ACTIVE.equals(location.getStatus())) {
            throw new AppException("Địa điểm đang bị khoá, không thể thay đổi bảng giá", HttpStatus.FORBIDDEN);
        }
    }

    private int resolveMinute(Integer minute, String time, String label) {
        if (minute != null) {
            return minute;
        }
        Integer parsed = OpeningTime.toMinute(time);
        if (parsed == null) {
            throw new AppException(label + " không hợp lệ, gửi " + (label.equals(START_LABEL) ? "startTime" : "endTime")
                    + " dạng HH:mm hoặc " + (label.equals(START_LABEL) ? "startMinute" : "endMinute"));
        }
        return parsed;
    }

    private BigDecimal requirePrice(BigDecimal price) {
        if (price == null) {
            throw new AppException("Giá mỗi slot không được để trống");
        }
        if (price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException("Giá mỗi slot phải lớn hơn 0");
        }
        return price;
    }

    private LocalDate requireValidFrom(LocalDate validFrom) {
        if (validFrom == null) {
            throw new AppException("Ngày bắt đầu hiệu lực không được để trống");
        }
        return validFrom;
    }

    /** ck_price_valid: valid_to null (không giới hạn) hoặc >= valid_from. */
    private void ensureValidRange(LocalDate validFrom, LocalDate validTo) {
        if (validTo != null && validTo.isBefore(validFrom)) {
            throw new AppException("Ngày kết thúc hiệu lực phải sau hoặc bằng ngày bắt đầu");
        }
    }

    /**
     * Chặn hai dòng giá cùng sân trùng cả ngày áp dụng, khung giờ và khoảng ngày hiệu lực,
     * vì khi đó một slot sẽ có hai mức giá và F3 không biết chọn giá nào.
     */
    private void ensureNoOverlap(Long courtId, String mask, int start, int end,
            LocalDate validFrom, LocalDate validTo, Long ignoreId) {
        for (PriceRule other : rulesOf(courtId)) {
            if (other.getId().equals(ignoreId)) {
                continue;
            }
            if (!ApplyDays.overlaps(mask, other.getApplyDays())) {
                continue;
            }
            if (start >= other.getEndMinute() || other.getStartMinute() >= end) {
                continue;
            }
            if (!dateRangesOverlap(validFrom, validTo, other.getValidFrom(), other.getValidTo())) {
                continue;
            }
            throw new AppException("Bảng giá bị trùng với quy tắc #" + other.getId() + " ("
                    + String.join(", ", ApplyDays.toLabels(other.getApplyDays())) + ", "
                    + OpeningTime.toTime(other.getStartMinute()) + "–"
                    + OpeningTime.toTime(other.getEndMinute()) + ")", HttpStatus.CONFLICT);
        }
    }

    private boolean dateRangesOverlap(LocalDate from1, LocalDate to1, LocalDate from2, LocalDate to2) {
        LocalDate end1 = to1 == null ? LocalDate.MAX : to1;
        LocalDate end2 = to2 == null ? LocalDate.MAX : to2;
        return !from1.isAfter(end2) && !from2.isAfter(end1);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
