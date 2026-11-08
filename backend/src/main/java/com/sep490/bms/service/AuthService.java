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
import com.sep490.bms.dto.request.ValidationRules;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.AccountAuditAction;
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
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final Pattern USERNAME_PATTERN = Pattern.compile(ValidationRules.USERNAME);
    private static final int OTP_EXPIRY_MINUTES = 10;
    private static final int MAX_FAILED_ATTEMPTS = 5;

    private final AccountRepository accountRepository;
    private final OtpRequestRepository otpRequestRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailService emailService;
    private final LocationRepository locationRepository;
    private final ObjectMapper objectMapper;
    private final OtpLockService otpLock;
    private final AccountAuditService audit;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public Map<String, Object> register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        otpLock.acquire(email);
        String phone = request.getPhone().trim();
        otpLock.acquire("phone:" + phone);
        if (otpRequestRepository.countActiveReservations(email, phone, LocalDateTime.now(), 0) > 0) {
            throw new AppException("Email hoặc số điện thoại đang chờ xác thực. Vui lòng xác thực, gửi lại OTP hoặc chờ hết 10 phút", HttpStatus.CONFLICT);
        }

        if (accountRepository.existsByEmail(email)) {
            throw new AppException("Địa chỉ email đã được sử dụng bởi tài khoản khác (MSG09)");
        }

        if (accountRepository.existsByPhone(phone)) {
            throw new AppException("Số điện thoại đã được sử dụng bởi tài khoản khác");
        }

        String username = request.getUsername();
        if (username == null || !USERNAME_PATTERN.matcher(username).matches()) throw new AppException(ValidationRules.USERNAME_MESSAGE);
        if (accountRepository.existsByUsername(username)) throw new AppException("Tên đăng nhập đã tồn tại");
        checkOtpLimit(email);

        String otpCode = generateOtpCode();
        String codeHash = passwordEncoder.encode(otpCode);

        Map<String, String> pendingData = new HashMap<>();
        pendingData.put("email", email);
        pendingData.put("phone", phone);
        pendingData.put("fullName", RegisterRequest.normalizeFullName(request.getFullName()));
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
        otpLock.acquire(email);
        String otp = request.getOtp().trim();

        OtpRequest otpRequest = otpRequestRepository
                .findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.REGISTER)
                .orElseThrow(() -> new AppException("Yêu cầu xác thực không tồn tại hoặc đã hết hạn (MSG96)"));

        if (otpRequest.getExpiresAt().isBefore(LocalDateTime.now())) {
            otpRequest.setPendingData(null);otpRequest.setUsedAt(LocalDateTime.now());
            otpRequestRepository.discardRegistration(email,LocalDateTime.now());
            throw new InvalidOtpException("Mã xác thực đã hết hạn. Vui lòng đăng ký lại (MSG96)");
        }

        if (otpRequest.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
            throw new AppException("Bạn đã nhập sai mã xác thực quá số lần quy định. Vui lòng gửi lại mã mới");
        }

        if (!passwordEncoder.matches(otp, otpRequest.getCodeHash())) {
            otpRequest.setFailedAttempts(otpRequest.getFailedAttempts() + 1);
            otpRequest.setUsedAt(LocalDateTime.now());otpRequest.setPendingData(null);
            otpRequestRepository.save(otpRequest);
            otpRequestRepository.discardRegistration(email,LocalDateTime.now());
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
        if (username == null || !USERNAME_PATTERN.matcher(username).matches()) {
            otpRequest.setPendingData(null);
            otpRequestRepository.discardRegistration(email, LocalDateTime.now());
            throw new InvalidOtpException(ValidationRules.USERNAME_MESSAGE + ". Vui lòng đăng ký lại");
        }
        otpLock.acquire("phone:" + pendingData.get("phone"));
        if (accountRepository.existsByEmail(email)) {
            throw new AppException("Tài khoản với email này đã tồn tại");
        }
        if (accountRepository.existsByUsername(username)) {
            throw new AppException("Tên đăng nhập đã tồn tại. Vui lòng đăng ký lại (DR22)");
        }

        if (accountRepository.existsByPhone(pendingData.get("phone"))) {
            throw new AppException("Số điện thoại đã được sử dụng bởi tài khoản khác");
        }
        otpRequest.setPendingData(null);
        otpRequestRepository.discardRegistration(email, LocalDateTime.now());

        Account account = Account.builder()
                .username(username)
                .email(pendingData.get("email"))
                .phone(pendingData.get("phone"))
                .fullName(RegisterRequest.normalizeFullName(pendingData.get("fullName")))
                .passwordHash(pendingData.get("passwordHash"))
                .role(Role.PLAYER)
                .status(AccountStatus.ACTIVE)
                .locationId(null)
                .build();

        Account saved = accountRepository.save(account);
        audit.record(saved.getId(), saved.getRole(), saved, AccountAuditAction.REGISTER_VERIFIED, null, null);

        String token = jwtTokenProvider.generateToken(saved);

        return LoginResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .user(UserDto.fromEntity(saved))
                .build();
    }

    @Transactional(noRollbackFor = InvalidOtpException.class)
    public void resendOtp(ResendOtpRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        otpLock.acquire(email);
        OtpPurpose purpose = request.getPurpose();

        if (purpose == OtpPurpose.REGISTER) {
            checkOtpLimit(email);
            OtpRequest latest = otpRequestRepository
                    .findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.REGISTER)
                    .orElseThrow(() -> new AppException("Không tìm thấy thông tin đăng ký đang chờ cho email này"));
            if(!latest.getExpiresAt().isAfter(LocalDateTime.now()) || latest.getPendingData()==null) {
                latest.setPendingData(null);latest.setUsedAt(LocalDateTime.now());
                otpRequestRepository.discardRegistration(email,LocalDateTime.now());
                throw new InvalidOtpException("Đăng ký đã hết hạn; vui lòng đăng ký lại (MSG96)");
            }

            if (accountRepository.existsByEmail(email)) {
                throw new AppException("Tài khoản với email này đã được kích hoạt");
            }

            String reservedPhone;
            try {
                reservedPhone = objectMapper.readValue(latest.getPendingData(), new TypeReference<Map<String, String>>() {}).get("phone");
            } catch (Exception ex) {
                throw new AppException("Không thể đọc dữ liệu đăng ký đang chờ");
            }
            otpLock.acquire("phone:" + reservedPhone);
            if (accountRepository.existsByPhone(reservedPhone)
                    || otpRequestRepository.countActiveReservations(email, reservedPhone, LocalDateTime.now(), 1) > 0) {
                throw new AppException("Số điện thoại đã được sử dụng hoặc đang chờ xác thực bởi yêu cầu khác", HttpStatus.CONFLICT);
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

    @Transactional(noRollbackFor=com.sep490.bms.exception.LoginAttemptException.class)
    public LoginResponse login(LoginRequest request) {
        String identifier = request.getEmail().trim();
        Account account = accountRepository.findByEmailOrUsernameForUpdate(identifier)
                .orElseThrow(() -> new AppException("Tài khoản hoặc mật khẩu không chính xác (MSG10)", HttpStatus.UNAUTHORIZED));

        if (!passwordEncoder.matches(request.getPassword(), account.getPasswordHash())) {
            if(account.getStatus()==AccountStatus.ACTIVE) {
                account.setFailedLoginCount(account.getFailedLoginCount()+1);
                if(account.getFailedLoginCount()>=5) {
                    account.setStatus(AccountStatus.LOCKED);account.setLockedUntil(LocalDateTime.now().plusMinutes(10));account.revokeTokens();
                }
                accountRepository.save(account);
            }
            throw new com.sep490.bms.exception.LoginAttemptException();
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
        account.setFailedLoginCount(0);account.setLockedUntil(null);account.setLastLoginAt(LocalDateTime.now());
        audit.record(account.getId(), account.getRole(), account, AccountAuditAction.LOGIN, null, null);

        return LoginResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .user(UserDto.fromEntity(account))
                .build();
    }

    @Transactional
    public void logout(UserPrincipal user) {
        if (user == null) throw new AppException("Yêu cầu đăng nhập", HttpStatus.UNAUTHORIZED);
        Account account = accountRepository.findByIdForUpdate(user.getId())
                .orElseThrow(() -> new AppException("Phiên đăng nhập không hợp lệ", HttpStatus.UNAUTHORIZED));
        // A queued logout with a stale token must not revoke a newly created generation.
        if (account.getTokenVersion() != user.getTokenVersion()) {
            throw new AppException("Phiên đăng nhập đã bị thu hồi", HttpStatus.UNAUTHORIZED);
        }
        account.revokeTokens();
        account.setUpdatedAt(LocalDateTime.now());
        accountRepository.save(account);
        audit.record(account.getId(), account.getRole(), account, AccountAuditAction.LOGOUT_ALL, null, null);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        otpLock.acquire(email);

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
        otpLock.acquire(email);
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

        Account account = accountRepository.findByEmailForUpdate(email)
                .orElseThrow(() -> new AppException("Không tìm thấy tài khoản để đặt lại mật khẩu"));

        if (account.getRole() == Role.STAFF) throw new AppException("Nhân viên cần liên hệ Owner để cấp lại mật khẩu");
        if (account.getStatus() != AccountStatus.ACTIVE) {
            throw new AppException("Tài khoản không hoạt động", HttpStatus.FORBIDDEN);
        }
        otpRequestRepository.invalidateUnused(email, OtpPurpose.RESET_PASSWORD, LocalDateTime.now());
        account.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        account.revokeTokens();
        account.setUpdatedAt(LocalDateTime.now());
        accountRepository.save(account);
        audit.record(account.getId(), account.getRole(), account, AccountAuditAction.PASSWORD_RESET, null, null);
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
