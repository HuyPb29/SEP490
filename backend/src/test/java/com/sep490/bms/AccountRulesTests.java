package com.sep490.bms;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.dto.request.*;
import com.sep490.bms.entity.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.*;
import com.sep490.bms.security.JwtTokenProvider;
import com.sep490.bms.service.*;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

class AccountRulesTests {
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final OtpRequestRepository otps = mock(OtpRequestRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final EmailService email = mock(EmailService.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final AuthService auth = new AuthService(accounts, otps, encoder, mock(JwtTokenProvider.class),
            email, mock(LocationRepository.class), mapper);

    @Test
    void hourlyAndDailyOtpLimitsRejectBeforeSending() {
        Account player = Account.builder().role(Role.PLAYER).status(AccountStatus.ACTIVE).build();
        when(accounts.findByEmail("player@example.com")).thenReturn(Optional.of(player));
        for (long[] counts : new long[][] {{1, 1, 1}, {0, 5, 5}, {0, 0, 10}}) {
            when(otps.countByEmailAndCreatedAtAfter(eq("player@example.com"), any()))
                    .thenReturn(counts[0], counts[1], counts[2]);
            assertThatThrownBy(() -> auth.forgotPassword(new ForgotPasswordRequest("player@example.com")))
                    .isInstanceOfSatisfying(AppException.class, ex -> {
                        assertThat(ex.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                        assertThat(ex.getMessage()).contains("MSG107");
                    });
        }
        verify(otps, never()).save(any());
        verifyNoInteractions(email);
    }

    @Test
    void staffCannotRequestResetOtpEvenIfLegacyAccountHasEmail() {
        when(accounts.findByEmail("staff@example.com")).thenReturn(Optional.of(
                Account.builder().role(Role.STAFF).status(AccountStatus.ACTIVE).build()));
        auth.forgotPassword(new ForgotPasswordRequest("staff@example.com"));
        auth.resendOtp(new ResendOtpRequest("staff@example.com", OtpPurpose.RESET_PASSWORD));
        verify(otps, never()).save(any());
        verifyNoInteractions(email);
    }

    @Test
    void usernameTakenDuringVerificationDoesNotChangeChosenUsername() throws Exception {
        var otp = OtpRequest.builder().expiresAt(LocalDateTime.now().plusMinutes(5)).codeHash("hash")
                .pendingData(mapper.writeValueAsString(java.util.Map.of("username", "chosen_name"))).build();
        when(otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc("p@example.com", OtpPurpose.REGISTER))
                .thenReturn(Optional.of(otp));
        when(encoder.matches("123456", "hash")).thenReturn(true);
        when(accounts.existsByUsername("chosen_name")).thenReturn(true);
        assertThatThrownBy(() -> auth.verifyEmail(new VerifyEmailRequest("p@example.com", "123456")))
                .isInstanceOf(AppException.class).hasMessageContaining("đăng ký lại");
        verify(accounts, never()).save(any());
    }

    @Test
    void allPasswordDtosShareTheSameRulesAndRegistrationRequiresUsername() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (String password : java.util.List.of("short1", "abcdefgh", "12345678", "Valid 123", "a1".repeat(17))) {
                assertThat(validator.validateValue(RegisterRequest.class, "password", password)).isNotEmpty();
                assertThat(validator.validateValue(CreateStaffRequest.class, "password", password)).isNotEmpty();
                assertThat(validator.validateValue(ResetPasswordRequest.class, "newPassword", password)).isNotEmpty();
                assertThat(validator.validateValue(ChangePasswordRequest.class, "newPassword", password)).isNotEmpty();
                assertThat(validator.validateValue(StaffPasswordRequest.class, "newPassword", password)).isNotEmpty();
            }
            assertThat(validator.validateValue(RegisterRequest.class, "password", "Valid123")).isEmpty();
            assertThat(validator.validateValue(RegisterRequest.class, "username", null)).isNotEmpty();
            assertThat(validator.validateValue(RegisterRequest.class, "phone", "1987654321")).isNotEmpty();
            assertThat(validator.validateValue(RegisterRequest.class, "fullName", "Nguyễn Văn Minh")).isEmpty();
            assertThat(validator.validateValue(RegisterRequest.class, "fullName", "Minh123")).isNotEmpty();
        }
    }
}
