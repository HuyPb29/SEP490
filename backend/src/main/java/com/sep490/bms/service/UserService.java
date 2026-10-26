package com.sep490.bms.service;

import java.time.LocalDateTime;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.sep490.bms.dto.UserDto;
import com.sep490.bms.dto.request.UpdateProfileRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserDto getCurrentUserProfile(Long userId) {
        Account account = accountRepository.findById(userId)
                .orElseThrow(() -> new AppException("Không tìm thấy người dùng"));
        return UserDto.fromEntity(account);
    }

    @Transactional
    public UserDto updateCurrentUserProfile(Long userId, UpdateProfileRequest request) {
        Account account = accountRepository.findById(userId)
                .orElseThrow(() -> new AppException("Không tìm thấy người dùng"));

        if (StringUtils.hasText(request.getFullName())) {
            account.setFullName(request.getFullName().trim());
        }

        if (StringUtils.hasText(request.getPhone())) {
            String newPhone = request.getPhone().trim();
            if (!newPhone.matches("^[0-9]{10}$")) {
                throw new AppException("Số điện thoại phải gồm đúng 10 chữ số (MSG02)");
            }
            if (!newPhone.equals(account.getPhone()) && account.getRole() == Role.PLAYER) {
                if (accountRepository.existsByPhoneAndRole(newPhone, Role.PLAYER)) {
                    throw new AppException("Số điện thoại này đã được sử dụng bởi người chơi khác");
                }
            }
            account.setPhone(newPhone);
        }

        if (request.getSkillLevel() != null) {
            account.setSkillLevel(request.getSkillLevel().trim());
        }

        if (StringUtils.hasText(request.getNewPassword())) {
            if (!StringUtils.hasText(request.getCurrentPassword())) {
                throw new AppException("Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu");
            }
            if (!passwordEncoder.matches(request.getCurrentPassword(), account.getPasswordHash())) {
                throw new AppException("Mật khẩu hiện tại không chính xác");
            }
            account.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        }

        account.setUpdatedAt(LocalDateTime.now());
        Account saved = accountRepository.save(account);
        return UserDto.fromEntity(saved);
    }
}
