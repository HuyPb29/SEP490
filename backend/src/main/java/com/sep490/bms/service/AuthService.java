package com.sep490.bms.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.dto.LoginResponse;
import com.sep490.bms.dto.UserDto;
import com.sep490.bms.dto.request.ForgotPasswordRequest;
import com.sep490.bms.dto.request.LoginRequest;
import com.sep490.bms.dto.request.RegisterRequest;
import com.sep490.bms.dto.request.ResendOtpRequest;
import com.sep490.bms.dto.request.ResetPasswordRequest;
import com.sep490.bms.dto.request.VerifyEmailRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.AccountStatus;
import com.sep490.bms.entity.OtpPurpose;
import com.sep490.bms.entity.OtpRequest;
import com.sep490.bms.entity.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.exception.InvalidOtpException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.OtpRequestRepository;
import com.sep490.bms.security.JwtTokenProvider;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-z][a-z0-9._]{3,19}$");
    private static final int OTP_EXPIRY_MINUTES = 10;
    private static final int MAX_FAILED_ATTEMPTS = 5;

    private final AccountRepository accountRepository;
    private final OtpRequestRepository otpRequestRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailService emailService;
    private final LocationRepository locationRepository;
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

        String username = request.getUsername();
        if (username == null || !USERNAME_PATTERN.matcher(username).matches()) throw new AppException("Tên đăng nhập không hợp lệ (DR22)");
        if (accountRepository.existsByUsername(username)) throw new AppException("Tên đăng nhập đã tồn tại");
        checkOtpLimit(email);

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

        otpRequestRepository.invalidateUnused(email, OtpPurpose.REGISTER, LocalDateTime.now());
        otpRequestRepository.save(otpRequest);

        emailService.sendVerificationOtp(email, otpCode);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "Đăng ký thành công! Mã xác thực đã được gửi tới email của bạn (MSG08).");
        result.put("email", email);
        result.put("username", username);
        return result;
    }

    @Transactional(noRollbackFor = InvalidOtpException.class)
    public LoginResponse verifyEmail(VerifyEmailRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        String otp = request.getOtp().trim();

        OtpRequest otpRequest = otpRequestRepository
                .findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.REGISTER)
                .orElseThrow(() -> new AppException("Yêu cầu xác thực không tồn tại hoặc đã hết hạn (MSG96)"));

        if (otpRequest.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new AppException("Mã xác thực đã hết hạn. Vui lòng yêu cầu gửi lại mã (MSG96)");
        }

        if (otpRequest.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
            throw new AppException("Bạn đã nhập sai mã xác thực quá số lần quy định. Vui lòng gửi lại mã mới");
        }

        if (!passwordEncoder.matches(otp, otpRequest.getCodeHash())) {
            otpRequest.setFailedAttempts(otpRequest.getFailedAttempts() + 1);
            otpRequestRepository.save(otpRequest);
            throw new InvalidOtpException();
        }

        otpRequest.setUsedAt(LocalDateTime.now());
        otpRequestRepository.save(otpRequest);

        Map<String, String> pendingData;
        try {
            pendingData = objectMapper.readValue(otpRequest.getPendingData(), new TypeReference<>() {});
        } catch (Exception e) {
            throw new AppException("Không thể đọc dữ liệu đăng ký đang chờ: " + e.getMessage());
        }

        String username = pendingData.get("username");
        if (accountRepository.existsByEmail(email)) {
            throw new AppException("Tài khoản với email này đã tồn tại");
        }
        if (accountRepository.existsByUsername(username)) {
            throw new AppException("Tên đăng nhập đã tồn tại. Vui lòng đăng ký lại (DR22)");
        }

        otpRequestRepository.invalidateUnused(email, OtpPurpose.REGISTER, LocalDateTime.now());

        Account account = Account.builder()
                .username(username)
                .email(pendingData.get("email"))
                .phone(pendingData.get("phone"))
                .fullName(pendingData.get("fullName"))
                .passwordHash(pendingData.get("passwordHash"))
                .role(Role.PLAYER)
                .status(AccountStatus.ACTIVE)
                .locationId(null)
                .build();

        Account saved = accountRepository.save(account);

        String token = jwtTokenProvider.generateToken(saved);

        return LoginResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .user(UserDto.fromEntity(saved))
                .build();
    }

    @Transactional
    public void resendOtp(ResendOtpRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        OtpPurpose purpose = request.getPurpose();

        if (purpose == OtpPurpose.REGISTER) {
            checkOtpLimit(email);
            OtpRequest latest = otpRequestRepository
                    .findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.REGISTER)
                    .orElseThrow(() -> new AppException("Không tìm thấy thông tin đăng ký đang chờ cho email này"));

            if (accountRepository.existsByEmail(email)) {
                throw new AppException("Tài khoản với email này đã được kích hoạt");
            }

            String newOtp = generateOtpCode();
            String codeHash = passwordEncoder.encode(newOtp);

            OtpRequest newOtpRequest = OtpRequest.builder()
                    .email(email)
                    .purpose(OtpPurpose.REGISTER)
                    .codeHash(codeHash)
                    .pendingData(latest.getPendingData())
                    .failedAttempts(0)
                    .expiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                    .build();

            otpRequestRepository.invalidateUnused(email, purpose, LocalDateTime.now());
            otpRequestRepository.save(newOtpRequest);
            emailService.sendVerificationOtp(email, newOtp);
        } else if (purpose == OtpPurpose.RESET_PASSWORD) {
            accountRepository.findByEmail(email).ifPresent(account -> {
                if (account.getStatus() == AccountStatus.ACTIVE && account.getRole() != Role.STAFF) {
                    checkOtpLimit(email);
                    String newOtp = generateOtpCode();
                    String codeHash = passwordEncoder.encode(newOtp);

                    OtpRequest newOtpRequest = OtpRequest.builder()
                            .email(email)
                            .purpose(OtpPurpose.RESET_PASSWORD)
                            .codeHash(codeHash)
                            .failedAttempts(0)
                            .expiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                            .build();

                    otpRequestRepository.invalidateUnused(email, purpose, LocalDateTime.now());
                    otpRequestRepository.save(newOtpRequest);
                    emailService.sendPasswordResetOtp(email, newOtp);
                }
            });
        }
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        String identifier = request.getEmail().trim();
        Account account = accountRepository.findByEmailOrUsername(identifier)
                .orElseThrow(() -> new AppException("Tài khoản hoặc mật khẩu không chính xác (MSG10)", HttpStatus.UNAUTHORIZED));

        if (!passwordEncoder.matches(request.getPassword(), account.getPasswordHash())) {
            throw new AppException("Tài khoản hoặc mật khẩu không chính xác (MSG10)", HttpStatus.UNAUTHORIZED);
        }

        if (account.getStatus() == AccountStatus.LOCKED) {
            throw new AppException("Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên (MSG11)", HttpStatus.FORBIDDEN);
        }

        if (account.getStatus() == AccountStatus.DISABLED) {
            throw new AppException("Tài khoản đã bị vô hiệu hóa (MSG11)", HttpStatus.FORBIDDEN);
        }

        if (account.getRole() == Role.STAFF && (account.getLocationId() == null
                || locationRepository.findById(account.getLocationId()).filter(l -> "ACTIVE".equals(l.getStatus())).isEmpty())) {
            throw new AppException("Địa điểm của nhân viên đã bị khóa", HttpStatus.FORBIDDEN);
        }
        String token = jwtTokenProvider.generateToken(account);

        return LoginResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .user(UserDto.fromEntity(account))
                .build();
    }

    public void logout() {
        log.info("User requested logout.");
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        accountRepository.findByEmail(email).ifPresent(account -> {
            if (account.getStatus() == AccountStatus.ACTIVE && account.getRole() != Role.STAFF) {
                    checkOtpLimit(email);
                String otpCode = generateOtpCode();
                String codeHash = passwordEncoder.encode(otpCode);

                OtpRequest otpRequest = OtpRequest.builder()
                        .email(email)
                        .purpose(OtpPurpose.RESET_PASSWORD)
                        .codeHash(codeHash)
                        .failedAttempts(0)
                        .expiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                        .build();

                otpRequestRepository.invalidateUnused(email, OtpPurpose.RESET_PASSWORD, LocalDateTime.now());
                otpRequestRepository.save(otpRequest);
                emailService.sendPasswordResetOtp(email, otpCode);
            }
        });
    }

    @Transactional(noRollbackFor = InvalidOtpException.class)
    public void resetPassword(ResetPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        String otp = request.getOtp().trim();

        OtpRequest otpRequest = otpRequestRepository
                .findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.RESET_PASSWORD)
                .orElseThrow(() -> new AppException("Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn (MSG96)"));

        if (otpRequest.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new AppException("Mã xác thực đã hết hạn. Vui lòng yêu cầu lại (MSG96)");
        }

        if (otpRequest.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
            throw new AppException("Bạn đã nhập sai mã xác thực quá số lần quy định. Vui lòng gửi lại mã mới");
        }

        if (!passwordEncoder.matches(otp, otpRequest.getCodeHash())) {
            otpRequest.setFailedAttempts(otpRequest.getFailedAttempts() + 1);
            otpRequestRepository.save(otpRequest);
            throw new InvalidOtpException();
        }

        otpRequest.setUsedAt(LocalDateTime.now());
        otpRequestRepository.save(otpRequest);

        Account account = accountRepository.findByEmail(email)
                .orElseThrow(() -> new AppException("Không tìm thấy tài khoản để đặt lại mật khẩu"));

        if (account.getRole() == Role.STAFF) throw new AppException("Nhân viên cần liên hệ Owner để cấp lại mật khẩu");
        otpRequestRepository.invalidateUnused(email, OtpPurpose.RESET_PASSWORD, LocalDateTime.now());
        account.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        account.setUpdatedAt(LocalDateTime.now());
        accountRepository.save(account);
    }

    private String generateOtpCode() {
        int code = 100000 + secureRandom.nextInt(900000);
        return String.valueOf(code);
    }

    private void checkOtpLimit(String email) {
        LocalDateTime now = LocalDateTime.now();
        if (otpRequestRepository.countByEmailAndCreatedAtAfter(email, now.minusSeconds(60)) > 0
                || otpRequestRepository.countByEmailAndCreatedAtAfter(email, now.minusHours(1)) >= 5
                || otpRequestRepository.countByEmailAndCreatedAtAfter(email, now.minusDays(1)) >= 10) {
            throw new AppException("Vượt giới hạn gửi OTP: chờ 60 giây, tối đa 5 lần/giờ và 10 lần/ngày (MSG107)", HttpStatus.TOO_MANY_REQUESTS);
        }
    }
}
