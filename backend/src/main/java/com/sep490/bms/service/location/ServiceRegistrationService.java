package com.sep490.bms.service.location;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.CreateServiceRegistrationRequest;
import com.sep490.bms.dto.location.RejectServiceRegistrationRequest;
import com.sep490.bms.dto.location.ServiceRegistrationDto;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.ServiceRegistration;
import com.sep490.bms.entity.location.ServiceTerm;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.location.ServiceRegistrationRepository;
import com.sep490.bms.repository.location.ServiceTermRepository;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC05 - Đăng ký sử dụng dịch vụ (FR13).
 *
 * Luồng: Owner gửi đơn (PENDING) -> Admin duyệt thì hệ thống mới tạo địa điểm thật
 * và mở một kỳ hạn sử dụng dịch vụ 12 tháng; Admin từ chối thì bắt buộc ghi lý do.
 * Đơn đã xử lý không được xử lý lại (tránh tạo trùng địa điểm).
 */
@Service
@RequiredArgsConstructor
public class ServiceRegistrationService {

    private static final int SERVICE_TERM_MONTHS = 12;
    private static final String STATUS_ACTIVE = "ACTIVE";

    private final ServiceRegistrationRepository serviceRegistrationRepository;
    private final ServiceTermRepository serviceTermRepository;
    private final LocationRepository locationRepository;
    private final AccountRepository accountRepository;

    /** UC05 - Owner gửi đơn đăng ký địa điểm mới. */
    @Transactional
    public ServiceRegistrationDto submit(UserPrincipal user, CreateServiceRegistrationRequest request) {
        if (user == null) {
            throw new AppException("Chưa đăng nhập", HttpStatus.UNAUTHORIZED);
        }
        if (user.getRole() != Role.OWNER) {
            throw new AppException("Chỉ Owner mới được đăng ký sử dụng dịch vụ", HttpStatus.FORBIDDEN);
        }

        ServiceRegistration entity = ServiceRegistration.builder()
                .requesterId(user.getId())
                .locationName(requireText(request.getLocationName(), "Tên địa điểm", 100))
                .address(requireText(request.getAddress(), "Địa chỉ", 255))
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .courtCount(request.getCourtCount())
                .contactName(trimToNull(request.getContactName()))
                .contactPhone(trimToNull(request.getContactPhone()))
                .contactEmail(trimToNull(request.getContactEmail()))
                .status(ApprovalStatus.PENDING)
                .build();

        return ServiceRegistrationDto.fromEntity(
                serviceRegistrationRepository.save(entity), principalName(user));
    }

    /** UC05 - Owner xem các đơn mình đã gửi, lọc tuỳ chọn theo trạng thái. */
    @Transactional(readOnly = true)
    public List<ServiceRegistrationDto> listMine(UserPrincipal user, String status) {
        if (user == null) {
            throw new AppException("Chưa đăng nhập", HttpStatus.UNAUTHORIZED);
        }
        ApprovalStatus filter = parseStatus(status);
        List<ServiceRegistration> items = filter == null
                ? serviceRegistrationRepository.findAllByRequesterIdOrderByCreatedAtDescIdDesc(user.getId())
                : serviceRegistrationRepository.findAllByRequesterIdAndStatusOrderByCreatedAtDescIdDesc(
                        user.getId(), filter);
        return toDtos(items);
    }

    /** UC05 - Admin xem toàn bộ đơn, lọc tuỳ chọn theo trạng thái. */
    @Transactional(readOnly = true)
    public List<ServiceRegistrationDto> listForAdmin(String status) {
        ApprovalStatus filter = parseStatus(status);
        List<ServiceRegistration> items = filter == null
                ? serviceRegistrationRepository.findAllByOrderByCreatedAtDescIdDesc()
                : serviceRegistrationRepository.findAllByStatusOrderByCreatedAtDescIdDesc(filter);
        return toDtos(items);
    }

    /**
     * UC05 - Admin duyệt đơn: tạo địa điểm thật cho owner gửi đơn và mở kỳ hạn dịch vụ 12 tháng.
     */
    @Transactional
    public ServiceRegistrationDto approve(UserPrincipal admin, Long registrationId) {
        ServiceRegistration entity = requirePending(registrationId);

        if (entity.getRequesterId() == null) {
            throw new AppException("Đơn không có người đăng ký nên không thể tạo địa điểm");
        }
        if (isBlank(entity.getContactPhone())) {
            throw new AppException("Đơn thiếu số điện thoại liên hệ, không thể duyệt");
        }

        LocalDateTime now = LocalDateTime.now();
        Location location = locationRepository.save(Location.builder()
                .ownerId(entity.getRequesterId())
                .name(entity.getLocationName())
                .address(entity.getAddress())
                .latitude(entity.getLatitude())
                .longitude(entity.getLongitude())
                .contactPhone(entity.getContactPhone())
                .status(STATUS_ACTIVE)
                .createdAt(now)
                .build());

        LocalDate startDate = LocalDate.now();
        serviceTermRepository.save(ServiceTerm.builder()
                .locationId(location.getId())
                .startDate(startDate)
                .endDate(startDate.plusMonths(SERVICE_TERM_MONTHS).minusDays(1))
                .recordedBy(admin == null ? null : admin.getId())
                .build());

        entity.setStatus(ApprovalStatus.APPROVED);
        entity.setLocationId(location.getId());
        entity.setProcessedBy(admin == null ? null : admin.getId());
        entity.setProcessedAt(now);
        entity.setRejectReason(null);

        ServiceRegistration saved = serviceRegistrationRepository.save(entity);
        return ServiceRegistrationDto.fromEntity(saved, requesterName(saved.getRequesterId()));
    }

    /** UC05 - Admin từ chối đơn, bắt buộc ghi lý do. */
    @Transactional
    public ServiceRegistrationDto reject(UserPrincipal admin, Long registrationId,
            RejectServiceRegistrationRequest request) {
        ServiceRegistration entity = requirePending(registrationId);
        String reason = requireText(request == null ? null : request.getReason(), "Lý do từ chối", 500);

        entity.setStatus(ApprovalStatus.REJECTED);
        entity.setRejectReason(reason);
        entity.setProcessedBy(admin == null ? null : admin.getId());
        entity.setProcessedAt(LocalDateTime.now());

        ServiceRegistration saved = serviceRegistrationRepository.save(entity);
        return ServiceRegistrationDto.fromEntity(saved, requesterName(saved.getRequesterId()));
    }

    // --------------------------------------------------------------- helpers

    /** Đơn phải đang PENDING: đã duyệt/từ chối rồi thì trả 409 để tránh tạo trùng địa điểm. */
    private ServiceRegistration requirePending(Long registrationId) {
        if (registrationId == null || registrationId <= 0) {
            throw new AppException("Mã đơn đăng ký không hợp lệ");
        }
        ServiceRegistration entity = serviceRegistrationRepository.findById(registrationId)
                .orElseThrow(() -> new AppException("Không tìm thấy đơn đăng ký", HttpStatus.NOT_FOUND));
        if (entity.getStatus() != ApprovalStatus.PENDING) {
            throw new AppException("Đơn đăng ký đã được xử lý (" + entity.getStatus() + ")", HttpStatus.CONFLICT);
        }
        return entity;
    }

    private List<ServiceRegistrationDto> toDtos(List<ServiceRegistration> items) {
        Map<Long, String> names = requesterNames(items);
        return items.stream()
                .map(item -> ServiceRegistrationDto.fromEntity(item, names.get(item.getRequesterId())))
                .toList();
    }

    private Map<Long, String> requesterNames(List<ServiceRegistration> items) {
        List<Long> ids = items.stream()
                .map(ServiceRegistration::getRequesterId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return accountRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Account::getId, this::displayName));
    }

    private String requesterName(Long requesterId) {
        if (requesterId == null) {
            return null;
        }
        return accountRepository.findById(requesterId).map(this::displayName).orElse(null);
    }

    private String displayName(Account account) {
        if (account == null) {
            return null;
        }
        return isBlank(account.getFullName()) ? account.getUsername() : account.getFullName();
    }

    private String principalName(UserPrincipal user) {
        if (user == null) {
            return null;
        }
        return isBlank(user.getFullName()) ? user.getUsername() : user.getFullName();
    }

    /** Lọc theo trạng thái: bỏ trống = tất cả, sai giá trị = 400. */
    private ApprovalStatus parseStatus(String status) {
        if (isBlank(status)) {
            return null;
        }
        try {
            return ApprovalStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new AppException("Trạng thái lọc không hợp lệ, chỉ nhận PENDING, APPROVED hoặc REJECTED");
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

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String trimToNull(String value) {
        String trimmed = value == null ? null : value.trim();
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }
}
