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

class AccountSrsRulesTests {
    final AccountRepository accounts=mock(AccountRepository.class);
    final OtpRequestRepository otps=mock(OtpRequestRepository.class);
    final PasswordEncoder encoder=mock(PasswordEncoder.class);
    final AuthService service=new AuthService(accounts,otps,encoder,mock(JwtTokenProvider.class),mock(EmailService.class),mock(LocationRepository.class),new ObjectMapper(),mock(OtpLockService.class),mock(AccountAuditService.class));
    @Test void registrationServiceRejectsUsernamesOutsideTheSrsLengthBeforeSendingOtp() {
        for (int length : new int[] {4,5,33}) {
            RegisterRequest request=RegisterRequest.builder().email("a@example.com").phone("0987654321")
                    .username("a".repeat(length)).fullName("Test Player").password("Original123").build();
            assertThatThrownBy(()->service.register(request)).hasMessageContaining("6–32");
        }
        verify(otps,never()).save(any());
    }
    @Test void verificationDiscardsLegacyPendingUsernamesThatNoLongerMeetTheSrsRule() throws Exception {
        OtpRequest otp=OtpRequest.builder().expiresAt(LocalDateTime.now().plusMinutes(5)).codeHash("hash")
                .pendingData(new ObjectMapper().writeValueAsString(java.util.Map.of("username","short"))).build();
        when(otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc("a@example.com",OtpPurpose.REGISTER)).thenReturn(Optional.of(otp));
        when(encoder.matches("123456","hash")).thenReturn(true);
        assertThatThrownBy(()->service.verifyEmail(new VerifyEmailRequest("a@example.com","123456"))).hasMessageContaining("6–32");
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
    @Test void wrongRegistrationOtpDiscardsPersonalDataAndCannotBeReused() {
        OtpRequest otp=OtpRequest.builder().expiresAt(LocalDateTime.now().plusMinutes(5)).codeHash("hash").pendingData("private").build();
        when(otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc("a@example.com",OtpPurpose.REGISTER)).thenReturn(Optional.of(otp));
        assertThatThrownBy(()->service.verifyEmail(new VerifyEmailRequest("a@example.com","000000"))).isInstanceOf(com.sep490.bms.exception.InvalidOtpException.class);
        assertThat(otp.getPendingData()).isNull();assertThat(otp.getUsedAt()).isNotNull();
        verify(otps).discardRegistration(eq("a@example.com"),any());verify(accounts,never()).save(any());
    }
    @Test void resendCannotReviveAnExpiredRegistration() {
        OtpRequest otp=OtpRequest.builder().expiresAt(LocalDateTime.now().minusMinutes(1)).pendingData("private").build();
        when(otps.findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc("a@example.com",OtpPurpose.REGISTER)).thenReturn(Optional.of(otp));
        assertThatThrownBy(()->service.resendOtp(new ResendOtpRequest("a@example.com",OtpPurpose.REGISTER))).hasMessageContaining("đăng ký lại");
        assertThat(otp.getPendingData()).isNull();verify(otps,never()).save(any());
    }
}
