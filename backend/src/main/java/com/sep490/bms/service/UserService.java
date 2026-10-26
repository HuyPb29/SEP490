package com.sep490.bms.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.sep490.bms.dto.UserDto;
import com.sep490.bms.entity.Account;
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
}
