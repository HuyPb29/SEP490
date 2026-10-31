package com.sep490.bms.service.location;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.AdminLocationDto;
import com.sep490.bms.dto.location.CourtDto;
import com.sep490.bms.dto.location.UpdateLocationStatusRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.ServiceTerm;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.ServiceTermRepository;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC06 - Admin quản lý các địa điểm đang sử dụng dịch vụ (FR14).
 *
 * Admin thấy toàn bộ địa điểm kèm chủ sở hữu, số sân và hạn dịch vụ, và có quyền
 * khoá/mở lại địa điểm. Dữ liệu admin ít nên service nạp một lần rồi ghép trong bộ nhớ
 * thay vì query từng địa điểm.
 */
@Service
@RequiredArgsConstructor
public class AdminLocationService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_LOCKED = "LOCKED";

    private final LocationRepository locationRepository;
    private final CourtRepository courtRepository;
    private final ServiceTermRepository serviceTermRepository;
    private final AccountRepository accountRepository;

    /** UC06 - Danh sách địa điểm, lọc tuỳ chọn theo trạng thái ACTIVE/LOCKED. */
    @Transactional(readOnly = true)
    public List<AdminLocationDto> list(String status) {
        String filter = parseStatus(status);
        List<Location> locations = locationRepository.findAll().stream()
                .filter(location -> filter == null || filter.equals(location.getStatus()))
                .sorted(Comparator.comparing(Location::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        if (locations.isEmpty()) {
            return List.of();
        }

        Map<Long, List<Court>> courtsByLocation = courtsByLocation();
        Map<Long, LocalDate> termEndByLocation = latestTermEndByLocation();
        Map<Long, Account> owners = owners(locations);

        return locations.stream()
                .map(location -> AdminLocationDto.fromEntity(
                        location,
                        owners.get(location.getOwnerId()),
                        courtsByLocation.getOrDefault(location.getId(), List.of()).size(),
                        termEndByLocation.get(location.getId()),
                        null))
                .toList();
    }

    /** UC06 - Chi tiết một địa điểm, kèm danh sách sân. */
    @Transactional(readOnly = true)
    public AdminLocationDto detail(Long locationId) {
        Location location = requireLocation(locationId);
        List<CourtDto> courts = courtRepository.findAllByLocationIdOrderByNameAsc(location.getId()).stream()
                .map(CourtDto::fromEntity)
                .toList();
        Account owner = location.getOwnerId() == null
                ? null
                : accountRepository.findById(location.getOwnerId()).orElse(null);
        LocalDate termEnd = serviceTermRepository.findAllByLocationId(location.getId()).stream()
                .map(ServiceTerm::getEndDate)
                .max(LocalDate::compareTo)
                .orElse(null);
        return AdminLocationDto.fromEntity(location, owner, courts.size(), termEnd, courts);
    }

    /** UC06 - Admin khoá địa điểm (vi phạm/hết hạn) hoặc mở lại. */
    @Transactional
    public AdminLocationDto updateStatus(Long locationId, UpdateLocationStatusRequest request) {
        Location location = requireLocation(locationId);
        String target = parseStatus(request == null ? null : request.getStatus());
        if (target == null) {
            throw new AppException("Trạng thái chỉ nhận ACTIVE hoặc LOCKED");
        }

        if (!target.equals(location.getStatus())) {
            location.setStatus(target);
            location.setLockedAt(STATUS_LOCKED.equals(target) ? LocalDateTime.now() : null);
            location.setUpdatedAt(LocalDateTime.now());
            locationRepository.save(location);
        }
        return detail(location.getId());
    }

    // --------------------------------------------------------------- helpers

    private Location requireLocation(Long locationId) {
        if (locationId == null || locationId <= 0) {
            throw new AppException("Mã địa điểm không hợp lệ");
        }
        return locationRepository.findById(locationId)
                .orElseThrow(() -> new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));
    }

    private Map<Long, List<Court>> courtsByLocation() {
        return courtRepository.findAll().stream()
                .collect(Collectors.groupingBy(Court::getLocationId));
    }

    private Map<Long, LocalDate> latestTermEndByLocation() {
        return serviceTermRepository.findAll().stream()
                .collect(Collectors.toMap(
                        ServiceTerm::getLocationId,
                        ServiceTerm::getEndDate,
                        (first, second) -> first.isAfter(second) ? first : second));
    }

    private Map<Long, Account> owners(List<Location> locations) {
        List<Long> ids = locations.stream()
                .map(Location::getOwnerId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return accountRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Account::getId, account -> account));
    }

    /** null = không lọc; giá trị lạ = 400. */
    private String parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String value = status.trim().toUpperCase();
        if (!STATUS_ACTIVE.equals(value) && !STATUS_LOCKED.equals(value)) {
            throw new AppException("Trạng thái lọc không hợp lệ, chỉ nhận ACTIVE hoặc LOCKED");
        }
        return value;
    }
}
