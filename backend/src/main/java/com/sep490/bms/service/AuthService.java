package com.sep490.bms.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.dto.request.RegisterRequest;
import com.sep490.bms.entity.OtpPurpose;
import com.sep490.bms.entity.OtpRequest;
import com.sep490.bms.entity.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.OtpRequestRepository;
import com.sep490.bms.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-z][a-z0-9._]{3,19}$");
    private static final int OTP_EXPIRY_MINUTES = 10;

    private final AccountRepository accountRepository;
    private final OtpRequestRepository otpRequestRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailService emailService;
    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public Map<String, Object> register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        String phone = request.getPhone().trim();

        if (accountRepository.existsByEmail(email)) {
            throw new AppException("Địa chỉ email đã được sử dụng bởi tài khoản khác (MSG09)");
        }

        if (accountRepository.existsByPhoneAndRole(phone, Role.PLAYER)) {
            throw new AppException("Số điện thoại này đã được đăng ký cho một tài khoản Player khác");
        }

        String username;
        if (request.getUsername() != null && !request.getUsername().trim().isEmpty()) {
            username = request.getUsername().trim().toLowerCase();
            if (!USERNAME_PATTERN.matcher(username).matches()) {
                throw new AppException("Tên đăng nhập phải bắt đầu bằng chữ cái thường, từ 4-20 ký tự (chỉ chứa chữ thường, số, dấu chấm, gạch dưới)");
            }
            if (accountRepository.existsByUsername(username)) {
                throw new AppException("Tên đăng nhập đã tồn tại trong hệ thống");
            }
        } else {
            username = generateCompliantUsername(email);
        }

        String otpCode = generateOtpCode();
        String codeHash = passwordEncoder.encode(otpCode);

        Map<String, String> pendingData = new HashMap<>();
        pendingData.put("email", email);
        pendingData.put("phone", phone);
        pendingData.put("fullName", request.getFullName().trim());
        pendingData.put("username", username);
        pendingData.put("passwordHash", passwordEncoder.encode(request.getPassword()));

        String pendingJson;
        try {
            pendingJson = objectMapper.writeValueAsString(pendingData);
        } catch (Exception e) {
            throw new AppException("Lỗi xử lý dữ liệu đăng ký: " + e.getMessage());
        }

        OtpRequest otpRequest = OtpRequest.builder()
                .email(email)
                .purpose(OtpPurpose.REGISTER)
                .codeHash(codeHash)
                .pendingData(pendingJson)
                .failedAttempts(0)
                .expiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                .build();

        otpRequestRepository.save(otpRequest);
        emailService.sendVerificationOtp(email, otpCode);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "Đăng ký thành công! Mã xác thực đã được gửi tới email của bạn (MSG08).");
        result.put("email", email);
        result.put("username", username);
        return result;
    }

    private String generateOtpCode() {
        int code = 100000 + secureRandom.nextInt(900000);
        return String.valueOf(code);
    }

    private String generateCompliantUsername(String email) {
        String prefix = email.split("@")[0].toLowerCase().replaceAll("[^a-z0-9._]", "");
        if (prefix.isEmpty() || !Character.isLetter(prefix.charAt(0))) {
            prefix = "u" + prefix;
        }
        if (prefix.length() < 4) {
            prefix = prefix + "123";
        }
        if (prefix.length() > 14) {
            prefix = prefix.substring(0, 14);
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
}
