package com.sep490.bms.service.account;
import java.time.LocalDateTime;
import java.util.Optional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.dto.request.*;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.OtpPurpose;
import com.sep490.bms.entity.account.OtpRequest;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.account.OtpRequestRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.service.integration.EmailService;
import com.sep490.bms.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Kiểm tra giới hạn tên đăng nhập v19, vòng đời OTP đăng ký và khóa đăng nhập tạm thời.
 */
class AccountSrsRulesTests {
    final AccountRepository accounts=mock(AccountRepository.class);
    final OtpRequestRepository otps=mock(OtpRequestRepository.class);
    final PasswordEncoder encoder=mock(PasswordEncoder.class);
    final AuthService service=new AuthService(accounts,otps,encoder,mock(JwtTokenProvider.class),mock(EmailService.class),mock(LocationRepository.class),new ObjectMapper(),mock(OtpLockService.class),mock(AccountAuditService.class));
    @Test void registrationServiceRejectsUsernamesOutsideV19LengthBeforeSendingOtp() {
        for (int length : new int[] {3,21,32}) {
            RegisterRequest request=RegisterRequest.builder().email("a@example.com").phone("0987654321")
                    .username("a".repeat(length)).fullName("Test Player").password("Original123").build();
            assertThatThrownBy(()->service.register(request)).hasMessageContaining("4–20");
        }
        verify(otps,never()).save(any());
    }
    @Test void verificationDiscardsLegacyPendingUsernamesThatNoLongerMeetV19Rule() throws Exception {
        OtpRequest otp=OtpRequest.builder().expiresAt(LocalDateTime.now().plusMinutes(5)).codeHash("hash")
                .pendingData(new ObjectMapper().writeValueAsString(java.util.Map.of("username","a".repeat(21)))).build();
        when(otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc("a@example.com",OtpPurpose.REGISTER)).thenReturn(Optional.of(otp));
        when(encoder.matches("123456","hash")).thenReturn(true);
        assertThatThrownBy(()->service.verifyEmail(new VerifyEmailRequest("a@example.com","123456"))).hasMessageContaining("4–20");
        assertThat(otp.getPendingData()).isNull();verify(accounts,never()).save(any());
        verify(otps).discardRegistration(eq("a@example.com"),any());
    }
    @Test void fiveConsecutiveBadLoginsLockTemporarilyAndRevokeTokens() {
        Account a=Account.builder().id(1L).role(Role.PLAYER).status(AccountStatus.ACTIVE).passwordHash("hash").build();
        when(accounts.findByEmailOrUsernameForUpdate("a")).thenReturn(Optional.of(a));
        for(int i=0;i<5;i++) assertThatThrownBy(()->service.login(new LoginRequest("a","wrong"))).hasMessageContaining("MSG10");
        assertThat(a.getStatus()).isEqualTo(AccountStatus.LOCKED);assertThat(a.getFailedLoginCount()).isEqualTo(5);
        assertThat(a.getLockedUntil()).isAfter(LocalDateTime.now().plusMinutes(9));assertThat(a.getTokenVersion()).isEqualTo(1);
    }
    @Test void badLoginNeverChangesAnAdminLockIntoAnExpiringLock() {
        Account a=Account.builder().id(1L).status(AccountStatus.LOCKED).build();
        when(accounts.findByEmailOrUsernameForUpdate("a")).thenReturn(Optional.of(a));
        assertThatThrownBy(()->service.login(new LoginRequest("a","wrong"))).hasMessageContaining("MSG10");
        assertThat(a.getLockedUntil()).isNull();assertThat(a.getFailedLoginCount()).isZero();
    }
    @Test void fifthWrongRegistrationOtpBlocksCodeButAllowsResend() {
        OtpRequest otp=OtpRequest.builder().expiresAt(LocalDateTime.now().plusMinutes(5)).codeHash("hash").pendingData("private").build();
        when(otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc("a@example.com",OtpPurpose.REGISTER)).thenReturn(Optional.of(otp));
        for (int i = 1; i <= 5; i++) {
            assertThatThrownBy(() -> service.verifyEmail(new VerifyEmailRequest("a@example.com", "000000")))
                    .isInstanceOf(com.sep490.bms.exception.InvalidOtpException.class);
            assertThat(otp.getFailedAttempts()).isEqualTo(i);
        }
        assertThatThrownBy(() -> service.verifyEmail(new VerifyEmailRequest("a@example.com", "123456")))
                .hasMessageContaining("MSG95");
        assertThat(otp.getPendingData()).isEqualTo("private");
        verify(accounts, never()).save(any());
    }
    @Test void resendCannotReviveAnExpiredRegistration() {
        OtpRequest otp=OtpRequest.builder().expiresAt(LocalDateTime.now().minusMinutes(1)).pendingData("private").build();
        when(otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc("a@example.com",OtpPurpose.REGISTER)).thenReturn(Optional.of(otp));
        assertThatThrownBy(()->service.resendOtp(new ResendOtpRequest("a@example.com",OtpPurpose.REGISTER))).hasMessageContaining("đăng ký lại");
        assertThat(otp.getPendingData()).isNull();verify(otps,never()).save(any());
    }
}
