package com.sep490.bms.service.location;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.CourtDto;
import com.sep490.bms.dto.location.LocationDetailDto;
import com.sep490.bms.dto.location.UpdateLocationRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.ServiceTerm;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.ServiceTermRepository;
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
    private final ServiceTermRepository serviceTermRepository;

    /** UC07 - Owner xem các địa điểm mình sở hữu, gồm cả địa điểm đang bị khoá. */
    @Transactional(readOnly = true)
    public List<LocationDetailDto> listOwned(UserPrincipal user) {
        requireOwner(user);
        List<Location> locations = locationRepository.findAllByOwnerId(user.getId()).stream()
                .sorted(Comparator.comparing(Location::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        Map<Long, LocalDate> termEnds = latestTermEnds(
                locations.stream().map(Location::getId).toList());
        Map<Long, List<CourtDto>> courtsByLocation = courtsOf(
                locations.stream().map(Location::getId).toList());
        return locations.stream()
                .map(location -> LocationDetailDto.fromEntity(location,
                        courtsByLocation.getOrDefault(location.getId(), List.of()),
                        termEnds.get(location.getId())))
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
        if (request.getLatitude() != null) {
            location.setLatitude(request.getLatitude());
        }
        if (request.getLongitude() != null) {
            location.setLongitude(request.getLongitude());
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
        return LocationDetailDto.fromEntity(saved, courts, latestTermEnd(saved.getId()));
    }

    // --------------------------------------------------------------- helpers

    /** Ngày hết hạn kỳ hạn dịch vụ gần nhất của một địa điểm; null nếu chưa có kỳ hạn. */
    private LocalDate latestTermEnd(Long locationId) {
        return serviceTermRepository.findAllByLocationId(locationId).stream()
                .map(ServiceTerm::getEndDate)
                .filter(endDate -> endDate != null)
                .max(LocalDate::compareTo)
                .orElse(null);
    }

    /** Như {@link #latestTermEnd(Long)} nhưng cho nhiều địa điểm, gom trong một truy vấn. */
    private Map<Long, LocalDate> latestTermEnds(List<Long> locationIds) {
        if (locationIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, LocalDate> termEnds = new HashMap<>();
        for (ServiceTerm term : serviceTermRepository.findAllByLocationIdIn(locationIds)) {
            if (term.getEndDate() == null) {
                continue;
            }
            termEnds.merge(term.getLocationId(), term.getEndDate(),
                    (current, candidate) -> candidate.isAfter(current) ? candidate : current);
        }
        return termEnds;
    }

    /**
     * Sân của nhiều địa điểm, gom trong một truy vấn và gom nhóm theo locationId.
     * Trả về Map rỗng khi Owner chưa có địa điểm nào.
     */
    private Map<Long, List<CourtDto>> courtsOf(List<Long> locationIds) {
        if (locationIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<CourtDto>> courtsByLocation = new HashMap<>();
        for (Court court : courtRepository.findAllByLocationIdInOrderByNameAsc(locationIds)) {
            courtsByLocation
                    .computeIfAbsent(court.getLocationId(), key -> new ArrayList<>())
                    .add(CourtDto.fromEntity(court));
        }
        return courtsByLocation;
    }

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
