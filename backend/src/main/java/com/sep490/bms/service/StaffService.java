package com.sep490.bms.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.UserDto;
import com.sep490.bms.dto.request.*;
import com.sep490.bms.entity.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.security.*;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StaffService {
    private final AccountRepository accountRepository;
    private final LocationAccessService locationAccess;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<UserDto> getStaffList(UserPrincipal user, String status, String search) {
        Long locationId = ownerLocation(user);
        AccountStatus requested = null;
        if (status != null && !status.isBlank()) {
            try { requested = AccountStatus.valueOf(status.trim().toUpperCase()); }
            catch (IllegalArgumentException ex) { throw new AppException("Trạng thái không hợp lệ"); }
        }
        final AccountStatus filter = requested;
        String term = search == null ? "" : search.trim().toLowerCase();
        return accountRepository.findByRoleAndLocationId(Role.STAFF, locationId).stream()
            .filter(a -> filter == null || a.getStatus() == filter)
            .filter(a -> java.util.stream.Stream.of(a.getFullName(), a.getUsername(), a.getPhone())
                .anyMatch(v -> v != null && v.toLowerCase().contains(term)))
            .map(UserDto::fromEntity).toList();
    }

    @Transactional
    public UserDto createStaff(UserPrincipal user, CreateStaffRequest request) {
        Long locationId = ownerLocation(user);
        if (accountRepository.existsByUsername(request.getUsername())) throw new AppException("Tên đăng nhập đã tồn tại");
        Account staff = Account.builder().username(request.getUsername()).email(null)
            .phone(request.getPhone()).fullName(request.getFullName().trim())
            .passwordHash(passwordEncoder.encode(request.getPassword()))
            .role(Role.STAFF).locationId(locationId).status(AccountStatus.ACTIVE).build();
        return UserDto.fromEntity(accountRepository.save(staff));
    }

    @Transactional
    public UserDto updateStaffStatus(UserPrincipal user, Long id, UpdateStatusRequest request) {
        Account staff = managedStaff(user, id);
        String status = request.getStatus().trim().toUpperCase();
        if (!List.of("ACTIVE", "DISABLED").contains(status)) throw new AppException("Chỉ chấp nhận ACTIVE hoặc DISABLED");
        if (staff.getStatus() == AccountStatus.LOCKED) {
            throw new AppException("Chỉ Admin được mở khóa tài khoản đã bị khóa", HttpStatus.FORBIDDEN);
        }
        staff.setStatus(AccountStatus.valueOf(status));
        staff.setUpdatedAt(LocalDateTime.now());
        return UserDto.fromEntity(accountRepository.save(staff));
    }

    @Transactional
    public void resetStaffPassword(UserPrincipal user, Long id, StaffPasswordRequest request) {
        Account staff = managedStaff(user, id);
        staff.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        staff.setUpdatedAt(LocalDateTime.now());
        accountRepository.save(staff);
    }

    private Long ownerLocation(UserPrincipal user) {
        if (user.getRole() != Role.OWNER) throw new AppException("Chỉ Owner được quản lý nhân viên", HttpStatus.FORBIDDEN);
        Location location = locationAccess.selectedLocation(user);
        if (!"ACTIVE".equals(location.getStatus())) throw new AppException("Địa điểm đã bị khóa", HttpStatus.FORBIDDEN);
        return location.getId();
    }

    private Account managedStaff(UserPrincipal user, Long id) {
        Long locationId = ownerLocation(user);
        Account staff = accountRepository.findById(id).orElseThrow(() -> new AppException("Không tìm thấy nhân viên", HttpStatus.NOT_FOUND));
        if (staff.getRole() != Role.STAFF || !locationId.equals(staff.getLocationId())) {
            throw new AppException("Không có quyền quản lý nhân viên này", HttpStatus.FORBIDDEN);
        }
        return staff;
    }
}
