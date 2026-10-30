package com.sep490.bms.service.location;

import java.time.LocalDate;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.CreateOpeningExceptionRequest;
import com.sep490.bms.dto.location.OpeningExceptionDto;
import com.sep490.bms.dto.location.UpdateOpeningExceptionRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.location.OpeningException;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.OpeningExceptionRepository;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Quản lý ngày mở cửa ngoại lệ (FR18, BR04).
 *
 * Mỗi địa điểm chỉ có 1 ngoại lệ cho 1 ngày (ràng buộc ux_oexc_date).
 */
@Service
@RequiredArgsConstructor
public class OpeningExceptionService {

    private static final String STATUS_ACTIVE = "ACTIVE";

    private final OpeningExceptionRepository openingExceptionRepository;
    private final LocationManagementService locationManagementService;

    /** UC08 - Danh sách ngoại lệ của địa điểm, lọc tuỳ chọn theo khoảng ngày. */
    @Transactional(readOnly = true)
    public List<OpeningExceptionDto> list(UserPrincipal user, Long locationId, LocalDate from, LocalDate to) {
        Location location = locationManagementService.ownedLocation(user, locationId);
        if (from != null && to != null && from.isAfter(to)) {
            throw new AppException("Ngày bắt đầu lọc không được sau ngày kết thúc");
        }

        return exceptionsOf(location.getId()).stream()
                .filter(item -> from == null || !item.getExceptionDate().isBefore(from))
                .filter(item -> to == null || !item.getExceptionDate().isAfter(to))
                .map(OpeningExceptionDto::fromEntity)
                .toList();
    }

    /** UC08 - Thêm ngoại lệ cho một ngày cụ thể. */
    @Transactional
    public OpeningExceptionDto create(UserPrincipal user, Long locationId, CreateOpeningExceptionRequest request) {
        Location location = locationManagementService.ownedLocation(user, locationId);
        if (!STATUS_ACTIVE.equals(location.getStatus())) {
            throw new AppException("Địa điểm đang bị khoá, không thể thêm ngày ngoại lệ", HttpStatus.FORBIDDEN);
        }

        LocalDate date = request.getExceptionDate();
        ensureDateAvailable(location.getId(), date, null);

        int open = OpeningWindowValidator.resolveMinute(request.getOpenMinute(), request.getOpenTime(), "Giờ mở cửa");
        int close = OpeningWindowValidator.resolveMinute(request.getCloseMinute(), request.getCloseTime(), "Giờ đóng cửa");
        OpeningWindowValidator.validate(open, close);

        OpeningException entity = OpeningException.builder()
                .locationId(location.getId())
                .exceptionDate(date)
                .openMinute(open)
                .closeMinute(close)
                .note(trimToNull(request.getNote()))
                .build();
        return OpeningExceptionDto.fromEntity(openingExceptionRepository.save(entity));
    }

    /** UC08 - Sửa ngoại lệ. Trường null nghĩa là giữ nguyên. */
    @Transactional
    public OpeningExceptionDto update(UserPrincipal user, Long exceptionId, UpdateOpeningExceptionRequest request) {
        OpeningException entity = requireException(exceptionId);
        locationManagementService.ownedLocation(user, entity.getLocationId());

        if (request.getExceptionDate() != null && !request.getExceptionDate().equals(entity.getExceptionDate())) {
            ensureDateAvailable(entity.getLocationId(), request.getExceptionDate(), entity.getId());
            entity.setExceptionDate(request.getExceptionDate());
        }

        boolean openNotSent = request.getOpenMinute() == null && isBlank(request.getOpenTime());
        boolean closeNotSent = request.getCloseMinute() == null && isBlank(request.getCloseTime());
        int open = openNotSent
                ? entity.getOpenMinute()
                : OpeningWindowValidator.resolveMinute(request.getOpenMinute(), request.getOpenTime(), "Giờ mở cửa");
        int close = closeNotSent
                ? entity.getCloseMinute()
                : OpeningWindowValidator.resolveMinute(request.getCloseMinute(), request.getCloseTime(), "Giờ đóng cửa");
        OpeningWindowValidator.validate(open, close);

        entity.setOpenMinute(open);
        entity.setCloseMinute(close);
        if (request.getNote() != null) {
            entity.setNote(trimToNull(request.getNote()));
        }
        return OpeningExceptionDto.fromEntity(openingExceptionRepository.save(entity));
    }

    /** UC08 - Xoá ngoại lệ, ngày đó quay lại dùng giờ mở cửa thường. */
    @Transactional
    public void delete(UserPrincipal user, Long exceptionId) {
        OpeningException entity = requireException(exceptionId);
        locationManagementService.ownedLocation(user, entity.getLocationId());
        openingExceptionRepository.delete(entity);
    }

    // --------------------------------------------------------------- helpers

    private List<OpeningException> exceptionsOf(Long locationId) {
        return openingExceptionRepository.findAllByLocationIdOrderByExceptionDateAsc(locationId);
    }

    private OpeningException requireException(Long exceptionId) {
        if (exceptionId == null || exceptionId <= 0) {
            throw new AppException("Mã ngày ngoại lệ không hợp lệ");
        }
        return openingExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new AppException("Không tìm thấy ngày ngoại lệ", HttpStatus.NOT_FOUND));
    }

    private void ensureDateAvailable(Long locationId, LocalDate date, Long ignoreId) {
        if (date == null) {
            throw new AppException("Ngày ngoại lệ không được để trống");
        }
        openingExceptionRepository.findByLocationIdAndExceptionDate(locationId, date)
                .filter(existing -> !existing.getId().equals(ignoreId))
                .ifPresent(existing -> {
                    throw new AppException("Ngày " + date + " đã có cấu hình ngoại lệ cho địa điểm này");
                });
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String trimToNull(String value) {
        String trimmed = value == null ? null : value.trim();
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }
}
