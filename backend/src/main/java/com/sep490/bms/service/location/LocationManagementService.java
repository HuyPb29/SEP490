package com.sep490.bms.service.location;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.CourtDto;
import com.sep490.bms.dto.location.LocationDetailDto;
import com.sep490.bms.dto.location.UpdateLocationRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC07 - Quản lý địa điểm và sân (phần thông tin địa điểm của Owner).
 *
 * Lưu ý phạm vi: các API đọc công khai (GET /api/locations, /api/locations/{id})
 * thuộc F3 - Tìm và đặt sân, không nằm trong service này.
 */
@Service
@RequiredArgsConstructor
public class LocationManagementService {

    private static final String STATUS_ACTIVE = "ACTIVE";

    private final LocationRepository locationRepository;
    private final CourtRepository courtRepository;

    /** UC07 - Owner xem các địa điểm mình sở hữu, gồm cả địa điểm đang bị khoá. */
    @Transactional(readOnly = true)
    public List<LocationDetailDto> listOwned(UserPrincipal user) {
        requireOwner(user);
        return locationRepository.findAllByOwnerId(user.getId()).stream()
                .sorted(Comparator.comparing(Location::getName, String.CASE_INSENSITIVE_ORDER))
                .map(location -> LocationDetailDto.fromEntity(location, null))
                .toList();
    }

    /** UC07 - Owner cập nhật thông tin địa điểm của mình. */
    @Transactional
    public LocationDetailDto updateOwned(UserPrincipal user, Long id, UpdateLocationRequest request) {
        Location location = ownedLocation(user, id);
        if (!STATUS_ACTIVE.equals(location.getStatus())) {
            throw new AppException("Địa điểm đang bị khoá, không thể cập nhật", HttpStatus.FORBIDDEN);
        }

        if (request.getName() != null) {
            location.setName(requireText(request.getName(), "Tên địa điểm", 100));
        }
        if (request.getAddress() != null) {
            location.setAddress(requireText(request.getAddress(), "Địa chỉ", 255));
        }
        if (request.getContactPhone() != null) {
            location.setContactPhone(request.getContactPhone().trim());
        }
        if (request.getBankName() != null) {
            location.setBankName(trimToNull(request.getBankName()));
        }
        if (request.getBankAccountNo() != null) {
            location.setBankAccountNo(trimToNull(request.getBankAccountNo()));
        }
        if (request.getBankAccountHolder() != null) {
            location.setBankAccountHolder(trimToNull(request.getBankAccountHolder()));
        }
        if (request.getQrImagePath() != null) {
            location.setQrImagePath(trimToNull(request.getQrImagePath()));
        }
        if (request.getAdvanceBookingDays() != null) {
            location.setAdvanceBookingDays(request.getAdvanceBookingDays());
        }
        if (request.getPointEarningRate() != null) {
            location.setPointEarningRate(request.getPointEarningRate());
        }
        location.setUpdatedAt(LocalDateTime.now());

        Location saved = locationRepository.save(location);
        List<CourtDto> courts = courtRepository.findAllByLocationIdOrderByNameAsc(saved.getId()).stream()
                .map(CourtDto::fromEntity)
                .toList();
        return LocationDetailDto.fromEntity(saved, courts);
    }

    // --------------------------------------------------------------- helpers

    /** Địa điểm theo id, đồng thời kiểm tra địa điểm thuộc Owner đang đăng nhập. */
    public Location ownedLocation(UserPrincipal user, Long id) {
        requireOwner(user);
        Location location = requireLocation(id);
        if (!user.getId().equals(location.getOwnerId())) {
            throw new AppException("Địa điểm không thuộc Owner", HttpStatus.FORBIDDEN);
        }
        return location;
    }

    public Location requireLocation(Long id) {
        if (id == null || id <= 0) {
            throw new AppException("Mã địa điểm không hợp lệ");
        }
        return locationRepository.findById(id)
                .orElseThrow(() -> new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));
    }

    private void requireOwner(UserPrincipal user) {
        if (user == null) {
            throw new AppException("Chưa đăng nhập", HttpStatus.UNAUTHORIZED);
        }
        if (user.getRole() != Role.OWNER) {
            throw new AppException("Chỉ Owner mới được quản lý địa điểm", HttpStatus.FORBIDDEN);
        }
    }

    private String requireText(String value, String fieldLabel, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new AppException(fieldLabel + " không được để trống");
        }
        if (trimmed.length() > maxLength) {
            throw new AppException(fieldLabel + " tối đa " + maxLength + " ký tự");
        }
        return trimmed;
    }

    private String trimToNull(String value) {
        String trimmed = value == null ? null : value.trim();
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }
}
