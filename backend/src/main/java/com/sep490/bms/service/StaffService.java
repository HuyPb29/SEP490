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
