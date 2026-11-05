package com.sep490.bms.service.location;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.CreateServiceTermRequest;
import com.sep490.bms.dto.location.ServiceTermDto;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.location.ServiceTerm;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.location.ServiceTermRepository;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC06 - Kỳ hạn sử dụng dịch vụ của địa điểm (FR14).
 *
 * Ràng buộc ck_sterm_12_months: mỗi kỳ hạn phải dài tối thiểu 12 tháng.
 * Các kỳ hạn của cùng một địa điểm không được chồng lấn để luôn xác định được hạn hiện tại.
 */
@Service
@RequiredArgsConstructor
public class ServiceTermService {

    private static final int MIN_MONTHS = 12;

    private final ServiceTermRepository serviceTermRepository;
    private final LocationRepository locationRepository;
    private final AccountRepository accountRepository;

    /** UC06 - Danh sách kỳ hạn dịch vụ của địa điểm. */
    @Transactional(readOnly = true)
    public List<ServiceTermDto> list(Long locationId) {
        Location location = requireLocation(locationId);
        List<ServiceTerm> terms =
                serviceTermRepository.findAllByLocationIdOrderByStartDateDescIdDesc(location.getId());
        Map<Long, String> recorderNames = recorderNames(terms);
        return terms.stream()
                .map(term -> ServiceTermDto.fromEntity(term, recorderNames.get(term.getRecordedBy())))
                .toList();
    }

    /** UC06 - Admin ghi nhận kỳ hạn mới (thường dùng để gia hạn nối tiếp kỳ cũ). */
    @Transactional
    public ServiceTermDto create(UserPrincipal admin, Long locationId, CreateServiceTermRequest request) {
        Location location = requireLocation(locationId);
        LocalDate startDate = request.getStartDate();
        LocalDate endDate = request.getEndDate();
        if (startDate == null || endDate == null) {
            throw new AppException("Ngày bắt đầu và ngày kết thúc không được để trống");
        }

        LocalDate minimumEnd = startDate.plusMonths(MIN_MONTHS).minusDays(1);
        if (endDate.isBefore(minimumEnd)) {
            throw new AppException("Kỳ hạn dịch vụ tối thiểu " + MIN_MONTHS
                    + " tháng, ngày kết thúc phải từ " + minimumEnd + " trở đi");
        }
        ensureNoOverlap(location.getId(), startDate, endDate);

        ServiceTerm entity = ServiceTerm.builder()
                .locationId(location.getId())
                .startDate(startDate)
                .endDate(endDate)
                .recordedBy(admin == null ? null : admin.getId())
                .build();
        return ServiceTermDto.fromEntity(serviceTermRepository.save(entity), principalName(admin));
    }

    // --------------------------------------------------------------- helpers

    private Location requireLocation(Long locationId) {
        if (locationId == null || locationId <= 0) {
            throw new AppException("Mã địa điểm không hợp lệ");
        }
        return locationRepository.findById(locationId)
                .orElseThrow(() -> new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));
    }

    /** Hai kỳ hạn trùng khoảng ngày sẽ làm hạn dịch vụ không xác định được. */
    private void ensureNoOverlap(Long locationId, LocalDate startDate, LocalDate endDate) {
        for (ServiceTerm other : serviceTermRepository.findAllByLocationId(locationId)) {
            boolean overlaps = !startDate.isAfter(other.getEndDate()) && !other.getStartDate().isAfter(endDate);
            if (overlaps) {
                throw new AppException("Kỳ hạn bị trùng với kỳ hạn #" + other.getId() + " ("
                        + other.getStartDate() + " → " + other.getEndDate() + ")", HttpStatus.CONFLICT);
            }
        }
    }

    private Map<Long, String> recorderNames(List<ServiceTerm> terms) {
        List<Long> ids = terms.stream()
                .map(ServiceTerm::getRecordedBy)
                .filter(id -> id != null)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return accountRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Account::getId, this::displayName));
    }

    private String displayName(Account account) {
        if (account == null) {
            return null;
        }
        return account.getFullName() == null || account.getFullName().isBlank()
                ? account.getUsername()
                : account.getFullName();
    }

    private String principalName(UserPrincipal user) {
        if (user == null) {
            return null;
        }
        return user.getFullName() == null || user.getFullName().isBlank()
                ? user.getUsername()
                : user.getFullName();
    }
}
