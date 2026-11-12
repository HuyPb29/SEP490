package com.sep490.bms.service.account;

import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.sep490.bms.dto.account.UserDto;
import com.sep490.bms.dto.request.ChangePasswordRequest;
import com.sep490.bms.dto.request.UpdateProfileRequest;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountAuditAction;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;

import lombok.RequiredArgsConstructor;

/**
 * Xử lý hồ sơ và đổi mật khẩu cho người dùng đang đăng nhập.
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccountAuditService audit;

    @Transactional(readOnly = true)
    public UserDto getCurrentUserProfile(Long userId) {
        Account account = accountRepository.findById(userId)
                .orElseThrow(() -> new AppException("Không tìm thấy người dùng"));
        return UserDto.fromEntity(account);
    }

    @Transactional
    public UserDto updateCurrentUserProfile(Long userId, UpdateProfileRequest request) {
        Account account = accountRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new AppException("Không tìm thấy người dùng"));

        if (StringUtils.hasText(request.getFullName())) {
            account.setFullName(request.getFullName().trim());
        }


        if (request.getSkillLevel() != null) {
            account.setSkillLevel(request.getSkillLevel().trim());
        }


        account.setUpdatedAt(LocalDateTime.now());
        Account saved = accountRepository.save(account);
        audit.record(account.getId(), account.getRole(), saved, AccountAuditAction.PROFILE_UPDATED, null, null);
        return UserDto.fromEntity(saved);
    }
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        Account account = accountRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new AppException("Không tìm thấy người dùng"));
        if (account.getRole() != Role.PLAYER && account.getRole() != Role.OWNER) {
            throw new AppException("Nhân viên cần liên hệ Owner để cấp lại mật khẩu", HttpStatus.FORBIDDEN);
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), account.getPasswordHash())) {
            throw new AppException("Mật khẩu hiện tại không chính xác (MSG113)");
        }
        account.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        account.revokeTokens();
        account.setUpdatedAt(LocalDateTime.now());
        accountRepository.save(account);
        audit.record(account.getId(), account.getRole(), account, AccountAuditAction.PASSWORD_CHANGED, null, null);
    }
}
