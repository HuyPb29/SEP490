package com.sep490.bms.service.location;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.sep490.bms.dto.location.CreateServiceRegistrationRequest;
import com.sep490.bms.dto.location.RejectServiceRegistrationRequest;
import com.sep490.bms.dto.request.ValidationRules;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.location.ServiceRegistration;
import com.sep490.bms.entity.location.ServiceTerm;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.location.ServiceRegistrationRepository;
import com.sep490.bms.repository.location.ServiceTermRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.account.OtpLockService;
import com.sep490.bms.service.integration.EmailService;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.notification.NotificationService;

/**
 * D168, D169: đăng ký sử dụng dịch vụ tự phục vụ (FR10, FR11, FR12, P35, DR22, DR23, MSG116, MSG117).
 */
class ServiceRegistrationServiceTests {

    private final ServiceRegistrationRepository registrations = mock(ServiceRegistrationRepository.class);
    private final ServiceTermRepository terms = mock(ServiceTermRepository.class);
    private final LocationRepository locations = mock(LocationRepository.class);
    private final CourtRepository courts = mock(CourtRepository.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final FileStorageService files = mock(FileStorageService.class);
    private final EmailService emails = mock(EmailService.class);
    private final OwnerCredentialGenerator credentials = new OwnerCredentialGenerator();
    private final ServiceRegistrationService service = new ServiceRegistrationService(registrations, terms, locations,
            courts, accounts, encoder, mock(NotificationService.class), mock(OtpLockService.class), files, emails,
            credentials);

    private final MockMultipartFile proof = new MockMultipartFile("proof", "ck.png", "image/png", new byte[] {1});
    private final UserPrincipal admin = UserPrincipal.builder().id(1L).role(Role.ADMIN).build();

    @BeforeEach
    void stubSaves() {
        when(registrations.save(any())).thenAnswer(call -> {
            ServiceRegistration entity = call.getArgument(0);
            if (entity.getId() == null) {
                entity.setId(50L);
            }
            return entity;
        });
        when(locations.save(any())).thenAnswer(call -> {
            Location location = call.getArgument(0);
            location.setId(9L);
            return location;
        });
        when(accounts.saveAndFlush(any())).thenAnswer(call -> {
            Account account = call.getArgument(0);
            account.setId(77L);
            return account;
        });
        when(files.storeImage(any(), anyString())).thenReturn("service-registration-proofs/2026/11/a.png");
        when(files.storeRegistrationDocument(any(), anyString(), anyString()))
                .thenAnswer(call -> call.getArgument(1) + "/test.pdf");
        when(encoder.encode(anyString())).thenAnswer(call -> "hash:" + call.getArgument(0));
    }

    // ---------------------------------------------------------------- P35

    @Test void verificationDocumentsAndConsentAreRequiredBeforeAnyFileIsStored() {
        var request = guestRequest(1, 1);
        request.setPrivacyAccepted(false);
        assertThatThrownBy(() -> submit(null, request, proof)).hasMessageContaining("cam kết bảo mật");
        request.setPrivacyAccepted(true);
        assertThatThrownBy(() -> service.submit(null, request, proof, null, proof)).hasMessageContaining("CCCD");
        assertThatThrownBy(() -> service.submit(null, request, proof, proof, null)).hasMessageContaining("giấy phép kinh doanh");
        verifyNoInteractions(files);
        verify(registrations, never()).save(any());
    }

    @Test void successfulSubmissionStoresBothDocumentsAndServerConsentTime() {
        var response = submit(null, guestRequest(1, 1), proof);
        assertThat(response.isHasIdentityDocument()).isTrue();
        assertThat(response.isHasBusinessLicense()).isTrue();
        assertThat(response.getPrivacyAcceptedAt()).isNotNull();
        var entity = ArgumentCaptor.forClass(ServiceRegistration.class);
        verify(registrations).save(entity.capture());
        assertThat(entity.getValue().getIdentityDocumentPath()).startsWith("service-registration-identities/");
        assertThat(entity.getValue().getBusinessLicensePath()).startsWith("service-registration-licenses/");
    }

    @Test void failedSubmissionCleansEveryUploadedFile() {
        org.mockito.Mockito.doThrow(new IllegalStateException("database unavailable")).when(registrations).save(any());
        assertThatThrownBy(() -> submit(null, guestRequest(1, 1), proof)).hasMessageContaining("database unavailable");
        verify(files).discardImage("service-registration-proofs/2026/11/a.png");
        verify(files).discardImage("service-registration-identities/test.pdf");
        verify(files).discardImage("service-registration-licenses/test.pdf");
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints = {0, 1})
    void filesFollowTheFinalTransactionOutcome(int completionStatus) {
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            submit(null, guestRequest(1, 1), proof);
            verify(files, never()).discardImage(anyString());
            org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()
                    .forEach(callback -> callback.afterCompletion(completionStatus));
            if (completionStatus == 0) verify(files, never()).discardImage(anyString());
            else {
                verify(files).discardImage("service-registration-proofs/2026/11/a.png");
                verify(files).discardImage("service-registration-identities/test.pdf");
                verify(files).discardImage("service-registration-licenses/test.pdf");
            }
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test void verificationDocumentsAreRestrictedToAdmin() {
        var owner = UserPrincipal.builder().id(7L).role(Role.OWNER).build();
        assertThatThrownBy(() -> service.loadVerificationDocument(null, 50L, "identity")).hasMessageContaining("Chỉ Admin");
        assertThatThrownBy(() -> service.loadVerificationDocument(owner, 50L, "identity")).hasMessageContaining("Chỉ Admin");
        verifyNoInteractions(files);
        var row = pendingGuest(1, 1);
        when(registrations.findById(50L)).thenReturn(Optional.of(row));
        service.loadVerificationDocument(admin, 50L, "identity");
        service.loadVerificationDocument(admin, 50L, "business-license");
        verify(files).load("identities/test.png");
        verify(files).load("licenses/test.pdf");
        assertThatThrownBy(() -> service.loadVerificationDocument(admin, 50L, "../../file")).hasMessageContaining("Loại giấy tờ");
    }

    @Test void legacyPendingRequestCannotBeApprovedWithoutVerification() {
        var row = pendingGuest(1, 1);
        row.setIdentityDocumentPath(null);
        when(registrations.findByIdForUpdate(50L)).thenReturn(Optional.of(row));
        assertThatThrownBy(() -> service.approve(admin, 50L)).hasMessageContaining("thiếu CCCD");
        verify(accounts, never()).saveAndFlush(any());
        verify(locations, never()).save(any());
    }

    @Test
    void rentalFeeFollowsP35AndRoundsUpToThousand() {
        assertThat(RentalFeeCalculator.amount(4, 1)).isEqualByComparingTo("4445000");
        assertThat(RentalFeeCalculator.amount(9, 1)).isEqualByComparingTo("10000000");
        assertThat(RentalFeeCalculator.amount(9, 2)).isEqualByComparingTo("20000000");
        assertThat(RentalFeeCalculator.amount(1, 1)).isEqualByComparingTo("1112000");
        assertThat(RentalFeeCalculator.amount(3, 3)).isEqualByComparingTo("10000000");
    }

    // ---------------------------------------------------------------- DR22, DR23

    @Test
    void generatedCredentialsFollowDr22AndDr23() {
        Pattern dr22 = Pattern.compile("^[a-z][a-z0-9._]{3,19}$");
        Pattern dr23 = Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d)\\S{8,32}$");
        IntStream.range(0, 200).forEach(i -> {
            String username = credentials.username();
            assertThat(username).matches(dr22).matches(ValidationRules.USERNAME);
            assertThat(credentials.password()).matches(dr23);
        });
    }

    // ---------------------------------------------------------------- UC05 gửi đơn

    @Test
    void guestSubmissionStoresYearsAmountProofAndTermsTime() {
        var saved = submit(null, guestRequest(4, 2), proof);

        assertThat(saved.getStatus()).isEqualTo("PENDING");
        assertThat(saved.getRentalYears()).isEqualTo(2);
        assertThat(saved.getRentalAmount()).isEqualByComparingTo("8889000");
        assertThat(saved.isHasProof()).isTrue();
        assertThat(saved.getTermsAcceptedAt()).isNotNull();
        assertThat(saved.getContactEmail()).isEqualTo("chu.san@example.com");
    }

    @Test
    void submissionRequiresTermsAndProofBeforeStoringAnything() {
        CreateServiceRegistrationRequest noTerms = guestRequest(4, 1);
        noTerms.setTermsAccepted(false);
        assertThatThrownBy(() -> submit(null, noTerms, proof))
                .isInstanceOf(AppException.class).hasMessageContaining("điều khoản");
        assertThatThrownBy(() -> submit(null, guestRequest(4, 1), null))
                .isInstanceOf(AppException.class).hasMessageContaining("chứng từ");
        verifyNoInteractions(files);
        verify(registrations, never()).save(any());
    }

    @Test
    void submissionRejectsRentalYearsBelowOne() {
        assertThatThrownBy(() -> submit(null, guestRequest(4, 0), proof))
                .isInstanceOf(AppException.class).hasMessageContaining("tối thiểu là 1 năm");
    }

    @Test
    void guestEmailWithAccountGetsMsg103() {
        when(accounts.existsByEmail("chu.san@example.com")).thenReturn(true);
        assertThatThrownBy(() -> submit(null, guestRequest(4, 1), proof))
                .isInstanceOfSatisfying(AppException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(ex.getMessage()).contains("MSG103");
                });
    }

    // ---------------------------------------------------------------- UC06 duyệt

    @Test
    void invalidContactsAndCoordinatesNeverStoreProofOrRegistration() {
        var request = guestRequest(4, 1);
        request.setContactPhone("abc1234567");
        assertThatThrownBy(() -> submit(null, request, proof)).hasMessageContaining("10 chữ số");
        request.setContactPhone("0933444555");
        request.setContactEmail("owner@localhost");
        assertThatThrownBy(() -> submit(null, request, proof)).hasMessageContaining("Email");
        request.setContactEmail("owner@example.com");
        request.setLatitude(BigDecimal.valueOf(91));
        assertThatThrownBy(() -> submit(null, request, proof)).hasMessageContaining("Tọa độ");
        verifyNoInteractions(files);
        verify(registrations, never()).save(any());
    }

    @Test
    void registrationRejectsNonZeroPhonePrefixAndNamesWithDigitsOrSymbols() {
        var request = guestRequest(4, 1);
        request.setContactPhone("1933444555");
        assertThatThrownBy(() -> submit(null, request, proof)).hasMessageContaining("bắt đầu bằng 0");
        request.setContactPhone("0933444555");
        for (String name : List.of("Anh123", "123456", "Nguyễn @ Anh")) {
            request.setContactName(name);
            assertThatThrownBy(() -> submit(null, request, proof)).hasMessageContaining("Họ tên");
        }
        verifyNoInteractions(files);
        verify(registrations, never()).save(any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"Nguyễn Văn Anh", "Nguyen Van Anh", "Nguye\u0302\u0303n Va\u0306n Anh"})
    void registrationAcceptsVietnameseAndUnaccentedNames(String name) {
        var request = guestRequest(4, 1);
        request.setContactName(name);
        assertThat(submit(null, request, proof).getContactName()).isEqualTo(name);
    }

    @Test
    void duplicatePhoneOrPendingEmailOrPendingPhoneNeverCreatesRequest() {
        when(accounts.existsByPhone("0933444555")).thenReturn(true);
        assertThatThrownBy(() -> submit(null, guestRequest(4, 1), proof)).hasMessageContaining("Số điện thoại");
        when(accounts.existsByPhone("0933444555")).thenReturn(false);
        when(registrations.existsByRequesterIdIsNullAndStatusAndContactEmailIgnoreCase(
                ApprovalStatus.PENDING, "chu.san@example.com")).thenReturn(true);
        assertThatThrownBy(() -> submit(null, guestRequest(4, 1), proof)).hasMessageContaining("Email");
        when(registrations.existsByRequesterIdIsNullAndStatusAndContactEmailIgnoreCase(
                ApprovalStatus.PENDING, "chu.san@example.com")).thenReturn(false);
        when(registrations.existsByRequesterIdIsNullAndStatusAndContactPhone(
                ApprovalStatus.PENDING, "0933444555")).thenReturn(true);
        assertThatThrownBy(() -> submit(null, guestRequest(4, 1), proof)).hasMessageContaining("Số điện thoại");
        verifyNoInteractions(files);
        verify(registrations, never()).save(any());
    }

    @Test
    void rejectionRequiresReasonAndEmailBeforeChangingStatus() {
        var pending = pendingGuest(2, 1);
        when(registrations.findByIdForUpdate(50L)).thenReturn(Optional.of(pending));
        assertThatThrownBy(() -> service.reject(admin, 50L, new RejectServiceRegistrationRequest("   ")))
                .hasMessageContaining("Lý do từ chối");
        pending.setContactEmail(null);
        assertThatThrownBy(() -> service.reject(admin, 50L, new RejectServiceRegistrationRequest("Không hợp lệ")))
                .hasMessageContaining("Email");
        assertThat(pending.getStatus()).isEqualTo(ApprovalStatus.PENDING);
        verifyNoInteractions(emails);
        verify(registrations, never()).save(any());
    }

    @Test
    void approvingGuestRequestCreatesOwnerTermByYearsAndEmailsCredentials() {
        ServiceRegistration pending = pendingGuest(3, 2);
        when(registrations.findByIdForUpdate(50L)).thenReturn(Optional.of(pending));

        service.approve(admin, 50L);

        ArgumentCaptor<Account> owner = ArgumentCaptor.forClass(Account.class);
        verify(accounts).saveAndFlush(owner.capture());
        assertThat(owner.getValue().getRole()).isEqualTo(Role.OWNER);
        assertThat(owner.getValue().getUsername()).matches("^owner\\d{6}$");

        ArgumentCaptor<ServiceTerm> term = ArgumentCaptor.forClass(ServiceTerm.class);
        verify(terms).save(term.capture());
        LocalDate today = LocalDate.now();
        assertThat(term.getValue().getStartDate()).isEqualTo(today);
        assertThat(term.getValue().getEndDate()).isEqualTo(today.plusYears(2).minusDays(1));

        ArgumentCaptor<String> username = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> password = ArgumentCaptor.forClass(String.class);
        DateTimeFormatter vn = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        verify(emails).sendServiceRegistrationApproved(eq("chu.san@example.com"), eq("Sân Bình Minh"), eq(3),
                eq("6.667.000"), eq(today.format(vn)), eq(today.plusYears(2).minusDays(1).format(vn)),
                username.capture(), password.capture());
        assertThat(username.getValue()).isEqualTo(owner.getValue().getUsername());
        // Mật khẩu gửi trong email là mật khẩu gốc; DB chỉ lưu bản băm của đúng mật khẩu đó.
        assertThat(owner.getValue().getPasswordHash()).isEqualTo("hash:" + password.getValue());
        assertThat(pending.getStatus()).isEqualTo(ApprovalStatus.APPROVED);
        assertThat(pending.getRequesterId()).isEqualTo(77L);
    }

    @Test
    void approvingOwnerExtraLocationEmailsWithoutCredentials() {
        ServiceRegistration pending = pendingGuest(2, 1);
        pending.setRequesterId(5L);
        when(registrations.findByIdForUpdate(50L)).thenReturn(Optional.of(pending));
        // approve khóa dòng tài khoản Owner trước khi kiểm tra trùng địa điểm (commit 25d27eb).
        when(accounts.findByIdForUpdate(5L)).thenReturn(Optional.of(
                Account.builder().id(5L).role(Role.OWNER).status(AccountStatus.ACTIVE).build()));

        service.approve(admin, 50L);

        verify(accounts, never()).saveAndFlush(any());
        verify(emails).sendServiceRegistrationApproved(eq("chu.san@example.com"), anyString(), eq(2),
                eq("2.223.000"), anyString(), anyString(), isNull(), isNull());
    }

    @Test
    void usernameCollisionPicksAnotherName() {
        ServiceRegistration pending = pendingGuest(2, 1);
        when(registrations.findByIdForUpdate(50L)).thenReturn(Optional.of(pending));
        when(accounts.existsByUsername(anyString())).thenReturn(true, true, false);

        service.approve(admin, 50L);

        verify(accounts, org.mockito.Mockito.times(3)).existsByUsername(anyString());
    }

    @Test
    void emailFailureAbortsApproval() {
        ServiceRegistration pending = pendingGuest(2, 1);
        when(registrations.findByIdForUpdate(50L)).thenReturn(Optional.of(pending));
        org.mockito.Mockito.doThrow(new AppException("Không gửi được email", HttpStatus.SERVICE_UNAVAILABLE))
                .when(emails).sendServiceRegistrationApproved(anyString(), anyString(), anyInt(), anyString(),
                        anyString(), anyString(), anyString(), anyString());

        // Exception thoát ra khỏi phương thức @Transactional thì Spring rollback toàn bộ lần duyệt.
        assertThatThrownBy(() -> service.approve(admin, 50L))
                .isInstanceOfSatisfying(AppException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    // ---------------------------------------------------------------- UC06 từ chối

    @Test
    void rejectingEmailsReason() {
        ServiceRegistration pending = pendingGuest(2, 1);
        when(registrations.findByIdForUpdate(50L)).thenReturn(Optional.of(pending));

        service.reject(admin, 50L, new RejectServiceRegistrationRequest("Chưa nhận được tiền thuê"));

        assertThat(pending.getStatus()).isEqualTo(ApprovalStatus.REJECTED);
        verify(emails).sendServiceRegistrationRejected("chu.san@example.com", "Sân Bình Minh",
                "Chưa nhận được tiền thuê");
    }

    @Test
    void processedRequestCannotBeApprovedAgain() {
        ServiceRegistration done = pendingGuest(2, 1);
        done.setStatus(ApprovalStatus.APPROVED);
        when(registrations.findByIdForUpdate(50L)).thenReturn(Optional.of(done));

        assertThatThrownBy(() -> service.approve(admin, 50L))
                .isInstanceOfSatisfying(AppException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT));
        verifyNoInteractions(emails);
    }

    private com.sep490.bms.dto.location.ServiceRegistrationDto submit(UserPrincipal user, CreateServiceRegistrationRequest request, org.springframework.web.multipart.MultipartFile transferProof) {
        return service.submit(user, request, transferProof,
                new MockMultipartFile("identityDocument", "cccd.png", "image/png", new byte[] {1}),
                new MockMultipartFile("businessLicense", "license.pdf", "application/pdf", new byte[] {1}));
    }

    // ---------------------------------------------------------------- helpers

    private CreateServiceRegistrationRequest guestRequest(int courtCount, int years) {
        return CreateServiceRegistrationRequest.builder()
                .locationName("Sân Bình Minh")
                .address("5 Lê Văn Lương, Hà Nội")
                .latitude(new BigDecimal("21.007000"))
                .longitude(new BigDecimal("105.800000"))
                .courtCount(courtCount)
                .rentalYears(years)
                .termsAccepted(true)
                .privacyAccepted(true)
                .contactName("Đỗ Văn Nam")
                .contactPhone("0933444555")
                .contactEmail("Chu.San@example.com")
                .build();
    }

    private ServiceRegistration pendingGuest(int courtCount, int years) {
        when(accounts.findByRoleAndStatus(Role.ADMIN, AccountStatus.ACTIVE)).thenReturn(List.of());
        return ServiceRegistration.builder()
                .id(50L)
                .locationName("Sân Bình Minh")
                .address("5 Lê Văn Lương, Hà Nội")
                .latitude(new BigDecimal("21.007000"))
                .longitude(new BigDecimal("105.800000"))
                .courtCount(courtCount)
                .rentalYears(years)
                .rentalAmount(RentalFeeCalculator.amount(courtCount, years))
                .proofImagePath("service-registration-proofs/2026/11/a.png")
                .identityDocumentPath("identities/test.png")
                .businessLicensePath("licenses/test.pdf")
                .privacyAcceptedAt(java.time.LocalDateTime.now())
                .contactName("Đỗ Văn Nam")
                .contactPhone("0933444555")
                .contactEmail("chu.san@example.com")
                .status(ApprovalStatus.PENDING)
                .build();
    }
}
