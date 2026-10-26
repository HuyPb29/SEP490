package com.sep490.bms.service;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import com.sep490.bms.dto.UserDto;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.AccountStatus;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.security.UserPrincipal;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StaffService {

    private static final java.util.regex.Pattern USERNAME_PATTERN = java.util.regex.Pattern.compile("^[a-z][a-z0-9._]{3,19}$");

    @Transactional
    public UserDto createStaff(UserPrincipal currentUser, com.sep490.bms.dto.request.CreateStaffRequest request) {
        Long targetLocationId;

        if (currentUser.getRole() == Role.OWNER) {
            Location location = locationRepository.findByOwnerId(currentUser.getId())
                    .orElseThrow(() -> new AppException("Chủ sân chưa có cơ sở trực thuộc để thêm nhân viên"));
            targetLocationId = location.getId();
        } else if (currentUser.getRole() == Role.ADMIN) {
            if (request.getLocationId() == null) {
                throw new AppException("Admin cần chỉ định mã cơ sở (locationId) cho nhân viên");
            }
            if (!locationRepository.existsById(request.getLocationId())) {
                throw new AppException("Cơ sở chỉ định không tồn tại");
            }
            targetLocationId = request.getLocationId();
        } else {
            throw new AppException("Bạn không có quyền tạo tài khoản nhân viên", HttpStatus.FORBIDDEN);
        }

        String email = request.getEmail().trim().toLowerCase();
        if (accountRepository.existsByEmail(email)) {
            throw new AppException("Địa chỉ email đã được sử dụng bởi tài khoản khác (MSG09)");
        }

        String phone = null;
        if (StringUtils.hasText(request.getPhone())) {
            phone = request.getPhone().trim();
            if (!phone.matches("^[0-9]{10}$")) {
                throw new AppException("Số điện thoại phải gồm đúng 10 chữ số (MSG02)");
            }
        }

        String username;
        if (StringUtils.hasText(request.getUsername())) {
            username = request.getUsername().trim().toLowerCase();
            if (!USERNAME_PATTERN.matcher(username).matches()) {
                throw new AppException("Tên đăng nhập phải bắt đầu bằng chữ cái thường, từ 4-20 ký tự");
            }
            if (accountRepository.existsByUsername(username)) {
                throw new AppException("Tên đăng nhập đã tồn tại trong hệ thống");
            }
        } else {
            username = generateStaffUsername(email);
        }

        Account staff = Account.builder()
                .username(username)
                .email(email)
                .phone(phone)
                .fullName(request.getFullName().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.STAFF)
                .locationId(targetLocationId)
                .status(AccountStatus.ACTIVE)
                .build();

        Account saved = accountRepository.save(staff);
        return UserDto.fromEntity(saved);
    }

    private String generateStaffUsername(String email) {
        String prefix = "s_" + email.split("@")[0].toLowerCase().replaceAll("[^a-z0-9._]", "");
        if (prefix.length() > 14) {
            prefix = prefix.substring(0, 14);
        }
        if (prefix.length() < 4) {
            prefix = prefix + "123";
        }

        String candidate = prefix;
        int count = 1;
        while (accountRepository.existsByUsername(candidate)) {
            candidate = prefix + count;
            if (candidate.length() > 20) {
                candidate = prefix.substring(0, 14) + count;
            }
            count++;
        }
        return candidate;
    }

    private final AccountRepository accountRepository;
    private final LocationRepository locationRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<UserDto> getStaffList(UserPrincipal currentUser, Long locationId, String status, String search) {
        Long targetLocationId;

        if (currentUser.getRole() == Role.OWNER) {
            Location location = locationRepository.findByOwnerId(currentUser.getId())
                    .orElseThrow(() -> new AppException("Chủ sân chưa có cơ sở trực thuộc nào"));
            targetLocationId = location.getId();
        } else if (currentUser.getRole() == Role.ADMIN) {
            targetLocationId = locationId;
        } else {
            throw new AppException("Bạn không có quyền truy cập danh sách nhân viên", HttpStatus.FORBIDDEN);
        }

        List<Account> staffList;
        if (targetLocationId != null) {
            staffList = accountRepository.findByRoleAndLocationId(Role.STAFF, targetLocationId);
        } else {
            staffList = accountRepository.findAll().stream()
                    .filter(a -> a.getRole() == Role.STAFF)
                    .collect(Collectors.toList());
        }

        return staffList.stream()
                .filter(a -> {
                    if (StringUtils.hasText(status)) {
                        try {
                            AccountStatus st = AccountStatus.valueOf(status.trim().toUpperCase());
                            return a.getStatus() == st;
                        } catch (IllegalArgumentException e) {
                            return true;
                        }
                    }
                    return true;
                })
                .filter(a -> {
                    if (StringUtils.hasText(search)) {
                        String s = search.trim().toLowerCase();
                        boolean matchName = a.getFullName() != null && a.getFullName().toLowerCase().contains(s);
                        boolean matchEmail = a.getEmail() != null && a.getEmail().toLowerCase().contains(s);
                        boolean matchPhone = a.getPhone() != null && a.getPhone().contains(s);
                        boolean matchUser = a.getUsername() != null && a.getUsername().toLowerCase().contains(s);
                        return matchName || matchEmail || matchPhone || matchUser;
                    }
                    return true;
                })
                .map(UserDto::fromEntity)
                .collect(Collectors.toList());
    }
}
