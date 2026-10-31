package com.sep490.bms.service.location;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.CourtDto;
import com.sep490.bms.dto.location.CreateCourtRequest;
import com.sep490.bms.dto.location.UpdateCourtRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC07 - Quản lý địa điểm và sân (phần sân con của Owner).
 *
 * Lưu ý phạm vi: API đọc công khai sân (GET /api/locations/{id}/courts, /api/courts/{id})
 * thuộc F3 - Tìm và đặt sân.
 */
@Service
@RequiredArgsConstructor
public class CourtManagementService {

    private static final String STATUS_ACTIVE = "ACTIVE";

    private final CourtRepository courtRepository;
    private final LocationManagementService locationManagementService;

    /** UC07 - Owner xem toàn bộ sân của địa điểm mình sở hữu, gồm cả sân đang tạm ngưng. */
    @Transactional(readOnly = true)
    public List<CourtDto> listOwned(UserPrincipal user, Long locationId) {
        Location location = locationManagementService.ownedLocation(user, locationId);
        return courtsOf(location.getId()).stream()
                .map(CourtDto::fromEntity)
                .toList();
    }

    /** UC07 - Owner thêm sân mới. Sân mới mặc định ở trạng thái hoạt động. */
    @Transactional
    public CourtDto create(UserPrincipal user, Long locationId, CreateCourtRequest request) {
        Location location = locationManagementService.ownedLocation(user, locationId);
        if (!STATUS_ACTIVE.equals(location.getStatus())) {
            throw new AppException("Địa điểm đang bị khoá, không thể thêm sân", HttpStatus.FORBIDDEN);
        }

        String name = request.getName() == null ? "" : request.getName().trim();
        if (name.isEmpty()) {
            throw new AppException("Tên sân không được để trống");
        }
        if (name.length() > 50) {
            throw new AppException("Tên sân tối đa 50 ký tự");
        }
        ensureNameAvailable(location.getId(), name, null);

        Court court = Court.builder()
                .locationId(location.getId())
                .name(name)
                .description(trimToNull(request.getDescription()))
                .active(true)
                .build();
        return CourtDto.fromEntity(courtRepository.save(court));
    }

    /** UC07 - Owner cập nhật tên, mô tả hoặc tạm ngưng sân. */
    @Transactional
    public CourtDto update(UserPrincipal user, Long courtId, UpdateCourtRequest request) {
        Court court = requireCourt(courtId);
        locationManagementService.ownedLocation(user, court.getLocationId());

        if (request.getName() != null) {
            String name = request.getName().trim();
            if (name.isEmpty()) {
                throw new AppException("Tên sân không được để trống");
            }
            if (name.length() > 50) {
                throw new AppException("Tên sân tối đa 50 ký tự");
            }
            ensureNameAvailable(court.getLocationId(), name, court.getId());
            court.setName(name);
        }
        if (request.getDescription() != null) {
            court.setDescription(trimToNull(request.getDescription()));
        }
        if (request.getIsActive() != null) {
            court.setActive(request.getIsActive());
        }
        court.setUpdatedAt(LocalDateTime.now());

        return CourtDto.fromEntity(courtRepository.save(court));
    }

    // --------------------------------------------------------------- helpers

    public Court requireCourt(Long courtId) {
        if (courtId == null || courtId <= 0) {
            throw new AppException("Mã sân không hợp lệ");
        }
        return courtRepository.findById(courtId)
                .orElseThrow(() -> new AppException("Không tìm thấy sân", HttpStatus.NOT_FOUND));
    }

    private List<Court> courtsOf(Long locationId) {
        return courtRepository.findAllByLocationIdOrderByNameAsc(locationId);
    }

    /** Tên sân không được trùng trong cùng một địa điểm (ràng buộc ux_court_name). */
    private void ensureNameAvailable(Long locationId, String name, Long ignoreCourtId) {
        courtRepository.findByLocationIdAndNameIgnoreCase(locationId, name)
                .filter(existing -> !existing.getId().equals(ignoreCourtId))
                .ifPresent(existing -> {
                    throw new AppException("Tên sân đã tồn tại trong địa điểm này");
                });
    }

    private String trimToNull(String value) {
        String trimmed = value == null ? null : value.trim();
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }
}
