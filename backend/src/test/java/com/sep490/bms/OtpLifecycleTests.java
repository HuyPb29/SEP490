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






}
