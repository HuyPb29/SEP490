package com.sep490.bms.service.location;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.location.CreateMaintenanceRequest;
import com.sep490.bms.dto.location.MaintenanceRequestDto;
import com.sep490.bms.dto.location.RejectMaintenanceRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.Maintenance;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.MaintenanceRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC10 - Quản lý bảo trì sân (FR23–FR25).
 *
 * Luồng: Staff gửi yêu cầu bảo trì (PENDING) cho một sân thuộc địa điểm mình làm
 * việc -> Owner duyệt (APPROVED) hoặc từ chối kèm lý do (REJECTED). Yêu cầu đã
 * xử lý không được duyệt/từ chối lại (trả 409) để giữ đúng lịch sử quyết định.
 *
 * Phạm vi địa điểm lấy theo header X-Location-Id; riêng STAFF bị ghim vào địa
 * điểm ghi trên tài khoản (xem {@link LocationAccessService}).
 */
@Service
@RequiredArgsConstructor
public class MaintenanceService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final int REASON_MAX_LENGTH = 500;
    /** Cột reason của bảng maintenance là NVARCHAR(1000). */
    private static final int REASON_STORAGE_MAX_LENGTH = 1000;
    /** ck_maint_half: phút bắt đầu/kết thúc chỉ được là 00 hoặc 30 và giây = 0. */
    private static final int SLOT_MINUTES = 30;

    private static final List<ApprovalStatus> BLOCKING_STATUSES =
            List.of(ApprovalStatus.PENDING, ApprovalStatus.APPROVED);

    private final MaintenanceRepository maintenanceRepository;
    private final CourtRepository courtRepository;
    private final AccountRepository accountRepository;
    private final LocationAccessService locationAccessService;

    /** UC10 - Danh sách yêu cầu bảo trì của địa điểm đang chọn (Staff và Owner dùng chung). */
    @Transactional(readOnly = true)
    public List<MaintenanceRequestDto> list(UserPrincipal user, String status) {
        Location location = locationAccessService.selectedLocation(user);
        List<Long> courtIds = courtIdsOf(location.getId());
        if (courtIds.isEmpty()) {
            return List.of();
        }
        ApprovalStatus filter = parseStatus(status);
        List<Maintenance> items = filter == null
                ? maintenanceRepository.findAllByCourtIdInOrderByCreatedAtDescIdDesc(courtIds)
                : maintenanceRepository.findAllByCourtIdInAndStatusOrderByCreatedAtDescIdDesc(courtIds, filter);
        return toDtos(items);
    }

    /** UC10 - Chi tiết một yêu cầu bảo trì, chỉ trong phạm vi địa điểm đang chọn. */
    @Transactional(readOnly = true)
    public MaintenanceRequestDto detail(UserPrincipal user, Long maintenanceId) {
        Location location = locationAccessService.selectedLocation(user);
        return toDto(requireRequestInLocation(location.getId(), maintenanceId));
    }

    /** UC10 - Staff gửi yêu cầu bảo trì cho một sân của địa điểm mình làm việc. */
    @Transactional
    public MaintenanceRequestDto create(UserPrincipal user, CreateMaintenanceRequest request) {
        if (user == null) {
            throw new AppException("Chưa đăng nhập", HttpStatus.UNAUTHORIZED);
        }
        Location location = locationAccessService.selectedLocation(user);
        requireActiveLocation(location, "gửi yêu cầu bảo trì");

        Court court = requireCourtInLocation(location.getId(), request.getCourtId());
        LocalDateTime startAt = requireSlotTime(request.getStartAt(), "Thời gian bắt đầu");
        LocalDateTime endAt = requireSlotTime(request.getEndAt(), "Thời gian kết thúc");
        ensureTimeRange(startAt, endAt);
        String reason = requireText(request.getReason(), "Lý do bảo trì", REASON_MAX_LENGTH);
        ensureNoOverlap(court.getId(), startAt, endAt);

        Maintenance entity = Maintenance.builder()
                .courtId(court.getId())
                .startAt(startAt)
                .endAt(endAt)
                .reason(reason)
                .status(ApprovalStatus.PENDING)
                .requestedBy(user.getId())
                .build();
        return toDto(maintenanceRepository.save(entity));
    }

    /** UC10 - Owner duyệt yêu cầu bảo trì đang chờ. */
    @Transactional
    public MaintenanceRequestDto approve(UserPrincipal user, Long maintenanceId) {
        Location location = locationAccessService.selectedLocation(user);
        Maintenance entity = requireRequestInLocation(location.getId(), maintenanceId);
        requirePending(entity);

        entity.setStatus(ApprovalStatus.APPROVED);
        entity.setApprovedBy(user == null ? null : user.getId());
        entity.setDecidedAt(LocalDateTime.now());
        return toDto(maintenanceRepository.save(entity));
    }

    /** UC10 - Owner từ chối yêu cầu bảo trì, bắt buộc ghi lý do. */
    @Transactional
    public MaintenanceRequestDto reject(UserPrincipal user, Long maintenanceId,
            RejectMaintenanceRequest request) {
        Location location = locationAccessService.selectedLocation(user);
        Maintenance entity = requireRequestInLocation(location.getId(), maintenanceId);
        requirePending(entity);
        String reason = requireText(request == null ? null : request.getReason(), "Lý do từ chối",
                REASON_MAX_LENGTH);

        entity.setStatus(ApprovalStatus.REJECTED);
        entity.setReason(withRejectNote(entity.getReason(), reason));
        entity.setApprovedBy(user == null ? null : user.getId());
        entity.setDecidedAt(LocalDateTime.now());
        return toDto(maintenanceRepository.save(entity));
    }

    // --------------------------------------------------------------- helpers

    private List<Long> courtIdsOf(Long locationId) {
        return courtRepository.findAllByLocationIdOrderByNameAsc(locationId).stream()
                .map(Court::getId)
                .toList();
    }

    private Court requireCourtInLocation(Long locationId, Long courtId) {
        if (courtId == null || courtId <= 0) {
            throw new AppException("Mã sân không hợp lệ");
        }
        Court court = courtRepository.findById(courtId)
                .orElseThrow(() -> new AppException("Không tìm thấy sân", HttpStatus.NOT_FOUND));
        if (!locationId.equals(court.getLocationId())) {
            throw new AppException("Sân không thuộc địa điểm này", HttpStatus.FORBIDDEN);
        }
        return court;
    }

    /** Yêu cầu bảo trì phải tồn tại và sân của nó thuộc địa điểm đang chọn. */
    private Maintenance requireRequestInLocation(Long locationId, Long maintenanceId) {
        if (maintenanceId == null || maintenanceId <= 0) {
            throw new AppException("Mã yêu cầu bảo trì không hợp lệ");
        }
        Maintenance entity = maintenanceRepository.findById(maintenanceId)
                .orElseThrow(() -> new AppException("Không tìm thấy yêu cầu bảo trì", HttpStatus.NOT_FOUND));
        Court court = courtRepository.findById(entity.getCourtId())
                .orElseThrow(() -> new AppException("Không tìm thấy sân của yêu cầu bảo trì",
                        HttpStatus.NOT_FOUND));
        if (!locationId.equals(court.getLocationId())) {
            throw new AppException("Yêu cầu bảo trì không thuộc địa điểm này", HttpStatus.FORBIDDEN);
        }
        return entity;
    }

    /** Chỉ yêu cầu đang PENDING mới được duyệt/từ chối; đã xử lý rồi thì trả 409. */
    private void requirePending(Maintenance entity) {
        if (entity.getStatus() != ApprovalStatus.PENDING) {
            throw new AppException("Yêu cầu bảo trì đã được xử lý (" + entity.getStatus() + ")",
                    HttpStatus.CONFLICT);
        }
    }

    /** ck_maint_half: phút 00/30, giây và nano phải bằng 0. */
    private LocalDateTime requireSlotTime(LocalDateTime value, String label) {
        if (value == null) {
            throw new AppException(label + " không được để trống");
        }
        if (value.getMinute() % SLOT_MINUTES != 0 || value.getSecond() != 0 || value.getNano() != 0) {
            throw new AppException(label + " phải theo khung 30 phút (phút 00 hoặc 30, giây bằng 0)");
        }
        return value;
    }

    /** ck_maint_time: end_at > start_at, và không nhận khoảng bảo trì đã kết thúc. */
    private void ensureTimeRange(LocalDateTime startAt, LocalDateTime endAt) {
        if (!endAt.isAfter(startAt)) {
            throw new AppException("Thời gian kết thúc phải sau thời gian bắt đầu");
        }
        if (!endAt.isAfter(LocalDateTime.now())) {
            throw new AppException("Thời gian bảo trì phải ở tương lai");
        }
    }

    /** Hai yêu cầu PENDING/APPROVED của cùng một sân không được chồng khung giờ. */
    private void ensureNoOverlap(Long courtId, LocalDateTime startAt, LocalDateTime endAt) {
        List<Maintenance> overlaps =
                maintenanceRepository.findOverlapping(courtId, BLOCKING_STATUSES, startAt, endAt);
        if (!overlaps.isEmpty()) {
            Maintenance first = overlaps.get(0);
            throw new AppException("Sân đã có yêu cầu bảo trì trùng khung giờ (mã " + first.getId()
                    + ", " + first.getStatus() + ")", HttpStatus.CONFLICT);
        }
    }

    private void requireActiveLocation(Location location, String action) {
        if (!STATUS_ACTIVE.equals(location.getStatus())) {
            throw new AppException("Địa điểm đang bị khoá, không thể " + action, HttpStatus.FORBIDDEN);
        }
    }

    /** Lý do từ chối được ghi nối vào cột reason vì bảng maintenance không có cột riêng. */
    private String withRejectNote(String originalReason, String rejectReason) {
        String base = originalReason == null ? "" : originalReason;
        String merged = base + MaintenanceRequestDto.REJECT_NOTE_SEPARATOR + rejectReason;
        return merged.length() > REASON_STORAGE_MAX_LENGTH
                ? merged.substring(0, REASON_STORAGE_MAX_LENGTH)
                : merged;
    }

    private MaintenanceRequestDto toDto(Maintenance entity) {
        Court court = courtRepository.findById(entity.getCourtId()).orElse(null);
        return MaintenanceRequestDto.fromEntity(entity,
                court == null ? null : court.getName(),
                court == null ? null : court.getLocationId(),
                accountName(entity.getRequestedBy()),
                accountName(entity.getApprovedBy()));
    }

    private List<MaintenanceRequestDto> toDtos(List<Maintenance> items) {
        if (items.isEmpty()) {
            return List.of();
        }
        Map<Long, Court> courts = courtsOf(items);
        Map<Long, String> names = accountNames(items);
        return items.stream()
                .map(item -> {
                    Court court = courts.get(item.getCourtId());
                    return MaintenanceRequestDto.fromEntity(item,
                            court == null ? null : court.getName(),
                            court == null ? null : court.getLocationId(),
                            item.getRequestedBy() == null ? null : names.get(item.getRequestedBy()),
                            item.getApprovedBy() == null ? null : names.get(item.getApprovedBy()));
                })
                .toList();
    }

    private Map<Long, Court> courtsOf(List<Maintenance> items) {
        List<Long> courtIds = items.stream()
                .map(Maintenance::getCourtId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        if (courtIds.isEmpty()) {
            return new HashMap<>();
        }
        return courtRepository.findAllById(courtIds).stream()
                .collect(Collectors.toMap(Court::getId, Function.identity()));
    }

    private Map<Long, String> accountNames(List<Maintenance> items) {
        List<Long> ids = items.stream()
                .flatMap(item -> Stream.of(item.getRequestedBy(), item.getApprovedBy()))
                .filter(id -> id != null)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return new HashMap<>();
        }
        return accountRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Account::getId, this::displayName));
    }

    private String accountName(Long accountId) {
        if (accountId == null) {
            return null;
        }
        return accountRepository.findById(accountId).map(this::displayName).orElse(null);
    }

    private String displayName(Account account) {
        if (account == null) {
            return null;
        }
        return isBlank(account.getFullName()) ? account.getUsername() : account.getFullName();
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
}
