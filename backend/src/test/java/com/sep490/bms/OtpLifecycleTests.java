package com.sep490.bms;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.sep490.bms.dto.request.*;
import com.sep490.bms.entity.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.*;
import com.sep490.bms.service.*;

/** No outer test transaction: assertions observe real service commits/rollbacks. */
@SpringBootTest
class OtpLifecycleTests {
    @Autowired AuthService auth;
    @Autowired AccountRepository accounts;
    @Autowired OtpRequestRepository otps;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean EmailService mail;

    private final String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    private final String email = "otp_" + suffix + "@example.com";

    @AfterEach
    void cleanup() {
        jdbc.update("DELETE FROM otp_request WHERE email = ?", email);
        jdbc.update("DELETE FROM account_audit WHERE target_account_id IN (SELECT id FROM account WHERE email = ?)", email);
        jdbc.update("DELETE FROM account WHERE email = ?", email);
    }

    private Account player() {
        return accounts.saveAndFlush(Account.builder().username("p" + suffix).email(email)
                .phone("0" + String.format("%09d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 1000000000L)))
                .fullName("Test Player").passwordHash(encoder.encode("Original123"))
                .role(Role.PLAYER).status(AccountStatus.ACTIVE).build());
    }

    private OtpRequest otp(OtpPurpose purpose) {
        return otps.saveAndFlush(OtpRequest.builder().email(email).purpose(purpose)
                .codeHash(encoder.encode("123456")).createdAt(LocalDateTime.now().minusMinutes(2))
                .expiresAt(LocalDateTime.now().plusMinutes(8)).build());
    }

    @Test
    void wrongAttemptsCommitAndBlockCorrectCodeForBothPurposes() {
        for (OtpPurpose purpose : OtpPurpose.values()) {
            OtpRequest request = otp(purpose);
            for (int i = 1; i <= 5; i++) {
                assertThatThrownBy(() -> verify(purpose, "000000")).isInstanceOf(AppException.class);
                assertThat(otps.findById(request.getId()).orElseThrow().getFailedAttempts()).isEqualTo(i);
            }
            assertThatThrownBy(() -> verify(purpose, "123456"))
                    .isInstanceOf(AppException.class).hasMessageContaining("quá số lần");
        }
    }

    private void verify(OtpPurpose purpose, String code) {
        if (purpose == OtpPurpose.REGISTER) auth.verifyEmail(new VerifyEmailRequest(email, code));
        else auth.resetPassword(new ResetPasswordRequest(email, code, "Changed123"));
    }

    @Test
    void resendInvalidatesOldResetCodeAndNeitherCodeCanReplayAfterSuccess() {
        player();
        OtpRequest old = otp(OtpPurpose.RESET_PASSWORD);
        auth.resendOtp(new ResendOtpRequest(email, OtpPurpose.RESET_PASSWORD));
        assertThat(otps.findById(old.getId()).orElseThrow().getUsedAt()).isNotNull();
        OtpRequest latest = otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.RESET_PASSWORD).orElseThrow();
        latest.setCodeHash(encoder.encode("654321"));
        otps.saveAndFlush(latest);
        assertThatThrownBy(() -> verify(OtpPurpose.RESET_PASSWORD, "123456")).isInstanceOf(AppException.class);
        verify(OtpPurpose.RESET_PASSWORD, "654321");
        assertThat(encoder.matches("Changed123", accounts.findByEmail(email).orElseThrow().getPasswordHash())).isTrue();
        assertThatThrownBy(() -> verify(OtpPurpose.RESET_PASSWORD, "123456")).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> verify(OtpPurpose.RESET_PASSWORD, "654321")).isInstanceOf(AppException.class);
    }

    @Test
    void smtpFailureRollsBackNewRequestAndPreservesPreviousCode() {
        player();
        OtpRequest old = otp(OtpPurpose.RESET_PASSWORD);
        doThrow(new AppException("Mail unavailable", HttpStatus.SERVICE_UNAVAILABLE))
                .when(mail).sendPasswordResetOtp(eq(email), anyString());
        assertThatThrownBy(() -> auth.forgotPassword(new ForgotPasswordRequest(email))).isInstanceOf(AppException.class);
        assertThat(otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.RESET_PASSWORD)
                .orElseThrow().getId()).isEqualTo(old.getId());
        assertThat(otps.countByEmailAndCreatedAtAfter(email, LocalDateTime.now().minusDays(1))).isEqualTo(1);
    }

    @Test
    void expiredCodeAndLockedAccountCannotResetPassword() {
        Account account = player();
        OtpRequest request = otp(OtpPurpose.RESET_PASSWORD);
        request.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        otps.saveAndFlush(request);
        assertThatThrownBy(() -> verify(OtpPurpose.RESET_PASSWORD, "123456")).hasMessageContaining("hết hạn");
        request.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        otps.saveAndFlush(request);
        account.setStatus(AccountStatus.LOCKED);
        accounts.saveAndFlush(account);
        assertThatThrownBy(() -> verify(OtpPurpose.RESET_PASSWORD, "123456"))
                .isInstanceOfSatisfying(AppException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThat(otps.findById(request.getId()).orElseThrow().getUsedAt()).isNull();
        assertThat(encoder.matches("Original123", accounts.findByEmail(email).orElseThrow().getPasswordHash())).isTrue();
    }

    @Test
    void concurrentResetConsumesCodeOnlyOnce() throws Exception {
        player();
        otp(OtpPurpose.RESET_PASSWORD);
        var pool = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        java.util.concurrent.Callable<Integer> reset = () -> {
            start.await();
            try {
                verify(OtpPurpose.RESET_PASSWORD, "123456");
                return 200;
            } catch (AppException ex) { return ex.getStatus().value(); }
        };
        try {
            var first = pool.submit(reset);
            var second = pool.submit(reset);
            start.countDown();
            assertThat(java.util.List.of(first.get(25, TimeUnit.SECONDS), second.get(25, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 400);
        } finally {
            pool.shutdownNow();
            pool.awaitTermination(10, TimeUnit.SECONDS);
        }
    }

    @Test
    void registrationResendInvalidatesOldCodeAndActivatesOnlyOnce() throws Exception {
        auth.register(RegisterRequest.builder().email(email).username("p" + suffix)
                .phone("0" + String.format("%09d", Math.floorMod((long) suffix.hashCode(), 1000000000L)))
                .fullName("Test Player").password("Original123").build());
        OtpRequest old = otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.REGISTER).orElseThrow();
        jdbc.update("UPDATE otp_request SET created_at = ? WHERE id = ?",
                java.sql.Timestamp.valueOf(LocalDateTime.now().minusMinutes(2)), old.getId());
        old.setCodeHash(encoder.encode("123456"));
        otps.saveAndFlush(old);
        auth.resendOtp(new ResendOtpRequest(email, OtpPurpose.REGISTER));
        assertThat(otps.findById(old.getId()).orElseThrow().getUsedAt()).isNotNull();
        OtpRequest latest = otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.REGISTER).orElseThrow();
        latest.setCodeHash(encoder.encode("654321"));
        otps.saveAndFlush(latest);
        assertThatThrownBy(() -> verify(OtpPurpose.REGISTER, "123456")).isInstanceOf(AppException.class);
        verify(OtpPurpose.REGISTER, "654321");
        assertThat(accounts.findByEmail(email).orElseThrow().getStatus()).isEqualTo(AccountStatus.ACTIVE);
        assertThatThrownBy(() -> verify(OtpPurpose.REGISTER, "123456")).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> verify(OtpPurpose.REGISTER, "654321")).isInstanceOf(AppException.class);
    }

    @Test
    void concurrentFirstRegistrationCannotBypassCooldown() throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        java.util.concurrent.Callable<Integer> register = () -> {
            start.await();
            try {
                auth.register(RegisterRequest.builder().email(email).username("p" + suffix)
                        .phone("0" + String.format("%09d", Math.floorMod((long) suffix.hashCode(), 1000000000L)))
                        .fullName("Test Player").password("Original123").build());
                return 201;
            } catch (AppException ex) { return ex.getStatus().value(); }
        };
        try {
            var first = pool.submit(register);
            var second = pool.submit(register);
            start.countDown();
            assertThat(java.util.List.of(first.get(25, TimeUnit.SECONDS), second.get(25, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(201, 409);
            assertThat(otps.countByEmailAndCreatedAtAfter(email, LocalDateTime.now().minusDays(1))).isEqualTo(1);
        } finally {
            pool.shutdownNow();
            pool.awaitTermination(10, TimeUnit.SECONDS);
        }
    }
    @Test
    void pendingRegistrationReservesEmailAndPhoneUntilExpiryAndNormalizesName() {
        String phone = "0" + String.format("%09d", Math.floorMod((long) suffix.hashCode(), 1000000000L));
        RegisterRequest request = RegisterRequest.builder().email(email).username("p" + suffix)
                .phone(phone).fullName("  Nguyễn   Văn A ").password("Original123").build();
        auth.register(request);
        assertThatThrownBy(() -> auth.register(request)).isInstanceOfSatisfying(AppException.class,
                ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT));
        request.setEmail("other_" + email);
        assertThatThrownBy(() -> auth.register(request)).isInstanceOfSatisfying(AppException.class,
                ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT));
        request.setEmail(email);
        OtpRequest pending = otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.REGISTER).orElseThrow();
        pending.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        otps.saveAndFlush(pending);
        jdbc.update("UPDATE otp_request SET created_at = ? WHERE id = ?",
                java.sql.Timestamp.valueOf(LocalDateTime.now().minusMinutes(11)), pending.getId());
        auth.register(request);
        OtpRequest current = otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(email, OtpPurpose.REGISTER).orElseThrow();
        current.setCodeHash(encoder.encode("123456"));
        otps.saveAndFlush(current);
        verify(OtpPurpose.REGISTER, "123456");
        assertThat(accounts.findByEmail(email).orElseThrow().getFullName()).isEqualTo("Nguyễn Văn A");
        RegisterRequest httpRequest = new RegisterRequest();
        httpRequest.setFullName("  Nguyễn   Văn A ");
        assertThat(httpRequest.getFullName()).isEqualTo("Nguyễn Văn A");
    }
}
