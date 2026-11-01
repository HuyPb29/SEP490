package com.sep490.bms.service.location;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.OpeningHourDto;
import com.sep490.bms.dto.location.OpeningHourItemRequest;
import com.sep490.bms.dto.location.UpdateOpeningHoursRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.location.OpeningHour;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.OpeningHourRepository;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Quản lý giờ mở cửa địa điểm (FR17).
 *
 * Ràng buộc lấy đúng theo schema BMS_database.sql để trả lỗi 400 dễ đọc
 * thay vì để DB ném lỗi CHECK:
 * - day_of_week 1..7, mỗi thứ chỉ 1 dòng (ux_ohour_day)
 * - close_minute > open_minute
 * - open_minute 0..1410, close_minute 30..1440, cả hai là bội số của 30
 */
@Service
@RequiredArgsConstructor
public class OpeningHourService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final int DAYS_IN_WEEK = 7;

    private final OpeningHourRepository openingHourRepository;
    private final LocationManagementService locationManagementService;

    /** UC08 - Xem giờ mở cửa của địa điểm. Luôn trả đủ 7 ngày. */
    @Transactional(readOnly = true)
    public List<OpeningHourDto> list(UserPrincipal user, Long locationId) {
        Location location = locationManagementService.ownedLocation(user, locationId);
        return buildWeek(hoursOf(location.getId()));
    }

    /** UC08 - Thay thế toàn bộ giờ mở cửa của địa điểm. */
    @Transactional
    public List<OpeningHourDto> replace(UserPrincipal user, Long locationId, UpdateOpeningHoursRequest request) {
        Location location = locationManagementService.ownedLocation(user, locationId);
        if (!STATUS_ACTIVE.equals(location.getStatus())) {
            throw new AppException("Địa điểm đang bị khoá, không thể cập nhật giờ mở cửa", HttpStatus.FORBIDDEN);
        }

        List<OpeningHour> existing = hoursOf(location.getId());
        Map<Integer, OpeningHour> byDay = new LinkedHashMap<>();
        existing.forEach(hour -> byDay.put(hour.getDayOfWeek(), hour));

        List<OpeningHour> toSave = new ArrayList<>();
        Set<Integer> submittedDays = new HashSet<>();

        for (OpeningHourItemRequest item : request.getHours()) {
            int day = item.getDayOfWeek();
            if (!submittedDays.add(day)) {
                throw new AppException("Thứ " + day + " bị gửi trùng trong yêu cầu");
            }

            int open = OpeningWindowValidator.resolveMinute(item.getOpenMinute(), item.getOpenTime(), "Giờ mở cửa");
            int close = OpeningWindowValidator.resolveMinute(item.getCloseMinute(), item.getCloseTime(), "Giờ đóng cửa");
            OpeningWindowValidator.validate(open, close);

            OpeningHour entity = byDay.get(day);
            if (entity == null) {
                entity = OpeningHour.builder()
                        .locationId(location.getId())
                        .dayOfWeek(day)
                        .build();
            }
            entity.setOpenMinute(open);
            entity.setCloseMinute(close);
            toSave.add(entity);
        }

        List<OpeningHour> removed = existing.stream()
                .filter(hour -> !submittedDays.contains(hour.getDayOfWeek()))
                .toList();
        if (!removed.isEmpty()) {
            openingHourRepository.deleteAll(removed);
        }
        openingHourRepository.saveAll(toSave);

        return buildWeek(hoursOf(location.getId()));
    }

    // --------------------------------------------------------------- helpers

    private List<OpeningHour> hoursOf(Long locationId) {
        return openingHourRepository.findAllByLocationIdOrderByDayOfWeekAsc(locationId);
    }

    /** Ghép dữ liệu DB thành đủ 7 ngày, ngày thiếu thì đánh dấu chưa cấu hình. */
    private List<OpeningHourDto> buildWeek(List<OpeningHour> hours) {
        Map<Integer, OpeningHour> byDay = new LinkedHashMap<>();
        hours.forEach(hour -> byDay.put(hour.getDayOfWeek(), hour));

        List<OpeningHourDto> week = new ArrayList<>(DAYS_IN_WEEK);
        for (int day = 1; day <= DAYS_IN_WEEK; day++) {
            OpeningHour hour = byDay.get(day);
            week.add(hour == null ? OpeningHourDto.unconfigured(day) : OpeningHourDto.fromEntity(hour));
        }
        return week;
    }
}
