package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.dto.request.CreateStaffRequest;
import com.sep490.bms.dto.request.ForgotPasswordRequest;
import com.sep490.bms.dto.request.LoginRequest;
import com.sep490.bms.dto.request.RegisterRequest;
import com.sep490.bms.dto.request.ResendOtpRequest;
import com.sep490.bms.dto.request.ResetPasswordRequest;
import com.sep490.bms.dto.request.UpdateProfileRequest;
import com.sep490.bms.dto.request.UpdateStatusRequest;
import com.sep490.bms.dto.request.VerifyEmailRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.AccountStatus;
import com.sep490.bms.entity.OtpPurpose;
import com.sep490.bms.entity.OtpRequest;
import com.sep490.bms.entity.Role;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.OtpRequestRepository;
import com.sep490.bms.security.JwtTokenProvider;

@SpringBootTest
@Transactional
class AuthAndUserApiTests {

    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private com.sep490.bms.service.EmailService emailService;

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private OtpRequestRepository otpRequestRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired private com.sep490.bms.repository.LocationRepository locationRepository;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Autowired private jakarta.persistence.EntityManager entityManager;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @Test
    void testAuthAndUserFlow() throws Exception {
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
        String testEmail = "test_" + uniqueSuffix + "@example.com";
        String testPhone = "098" + (int)(1000000 + Math.random() * 9000000);
        String password = "Password123@";

        // 1. POST /api/auth/register
        RegisterRequest registerReq = RegisterRequest.builder()
                .email(testEmail)
                .username("player_" + uniqueSuffix)
                .phone(testPhone)
                .password(password)
                .fullName("Nguyễn Văn Test")
                .build();

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));

        // Retrieve OTP request
        OtpRequest otpReq = otpRequestRepository
                .findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(testEmail, OtpPurpose.REGISTER)
                .orElseThrow();
        assertThat(otpReq).isNotNull();

        // 2. POST /api/auth/verify-email
        otpReq.setCodeHash(passwordEncoder.encode("123456"));
        otpRequestRepository.save(otpReq);

        VerifyEmailRequest verifyReq = VerifyEmailRequest.builder()
                .email(testEmail)
                .otp("123456")
                .build();

        MvcResult verifyResult = mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(verifyReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andReturn();

        JsonNode verifyNode = objectMapper.readTree(verifyResult.getResponse().getContentAsString());
        String playerToken = verifyNode.get("data").get("token").asText();

        // 3. POST /api/auth/login
        LoginRequest loginReq = LoginRequest.builder()
                .email(testEmail)
                .password(password)
                .build();

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty());

        // Move the first request outside the resend cooldown without sleeping.
        jdbcTemplate.update("UPDATE otp_request SET created_at = ? WHERE id = ?",
                java.sql.Timestamp.valueOf(java.time.LocalDateTime.now().minusMinutes(2)), otpReq.getId());

        // 4. POST /api/auth/resend-otp
        ResendOtpRequest resendReq = ResendOtpRequest.builder()
                .email(testEmail)
                .purpose(OtpPurpose.RESET_PASSWORD)
                .build();

        mockMvc.perform(post("/api/auth/resend-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resendReq)))
                .andExpect(status().isOk());

        // 5. POST /api/auth/forgot-password
        ForgotPasswordRequest forgotReq = ForgotPasswordRequest.builder()
                .email(testEmail)
                .build();

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(forgotReq)))
                .andExpect(status().isTooManyRequests());

        // 6. POST /api/auth/reset-password
        OtpRequest resetOtp = otpRequestRepository
                .findTopByEmailAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(testEmail, OtpPurpose.RESET_PASSWORD)
                .orElseThrow();
        resetOtp.setCodeHash(passwordEncoder.encode("654321"));
        otpRequestRepository.save(resetOtp);

        String newPassword = "NewPassword123@";
        ResetPasswordRequest resetPassReq = ResetPasswordRequest.builder()
                .email(testEmail)
                .otp("654321")
                .newPassword(newPassword)
                .build();

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetPassReq)))
                .andExpect(status().isOk());

        // Login with new password
        loginReq.setPassword(newPassword);
        MvcResult reLoginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode reLoginNode = objectMapper.readTree(reLoginResult.getResponse().getContentAsString());
        playerToken = reLoginNode.get("data").get("token").asText();

        // 7. POST /api/auth/logout
        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + playerToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + playerToken))
                .andExpect(status().isUnauthorized());
        playerToken = jwtTokenProvider.generateToken(accountRepository.findByEmail(testEmail).orElseThrow());

        // 8. GET /api/users/me
        mockMvc.perform(get("/api/users/me")
                        .header("Authorization", "Bearer " + playerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(testEmail));

        // 9. PATCH /api/users/me
        UpdateProfileRequest updateProfileReq = UpdateProfileRequest.builder()
                .fullName("Nguyễn Văn Updated")
                .skillLevel("Trung bình")
                .build();

        mockMvc.perform(patch("/api/users/me")
                        .header("Authorization", "Bearer " + playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateProfileReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fullName").value("Nguyễn Văn Updated"))
                .andExpect(jsonPath("$.data.skillLevel").value("Trung bình"));

        // Setup Owner & Admin accounts for testing Staff and Admin endpoints
        Account owner = fixtureAccount("owner_" + uniqueSuffix, Role.OWNER);
        String ownerToken = jwtTokenProvider.generateToken(owner);
        Account admin = fixtureAccount("admin_" + uniqueSuffix, Role.ADMIN);
        String adminToken = jwtTokenProvider.generateToken(admin);
        var location = fixtureLocation(owner);
        fixtureLocation(owner); // Regression: an owner may own more than one location.

        // 10. GET /api/owner/staff-members (as Owner)
        mockMvc.perform(get("/api/owner/staff-members")
                        .header("Authorization", "Bearer " + ownerToken)
                        .header("X-Location-Id", location.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // 11. POST /api/owner/staff-members (as Owner)
        String staffEmail = "staff_" + uniqueSuffix + "@example.com";
        CreateStaffRequest createStaffReq = CreateStaffRequest.builder()
                .username("staff_" + uniqueSuffix)
                .fullName("Nhân Viên")
                .password("Staff123@")
                .phone("093" + (int)(1000000 + Math.random() * 9000000))
                .build();

        MvcResult createStaffResult = mockMvc.perform(post("/api/owner/staff-members")
                        .header("Authorization", "Bearer " + ownerToken)
                        .header("X-Location-Id", location.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createStaffReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.username").value("staff_" + uniqueSuffix))
                .andReturn();

        JsonNode staffNode = objectMapper.readTree(createStaffResult.getResponse().getContentAsString());
        long createdStaffId = staffNode.get("data").get("id").asLong();

        // 12. PATCH /api/owner/staff-members/{id}/status (as Owner)
        UpdateStatusRequest updateStaffStatusReq = UpdateStatusRequest.builder()
                .status("DISABLED")
                .build();

        mockMvc.perform(patch("/api/owner/staff-members/" + createdStaffId + "/status")
                        .header("Authorization", "Bearer " + ownerToken)
                        .header("X-Location-Id", location.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateStaffStatusReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));

        // 13. GET /api/admin/accounts (as Admin)
        mockMvc.perform(get("/api/admin/accounts?page=0&size=10")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray())
                .andExpect(jsonPath("$.data.totalElements").isNumber());

        // 14. PATCH /api/admin/accounts/{id}/status (as Admin)
        UpdateStatusRequest updateAccountStatusReq = UpdateStatusRequest.builder()
                .status("LOCKED")
                .reason("Khóa thử nghiệm")
                .build();

        mockMvc.perform(patch("/api/admin/accounts/" + createdStaffId + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateAccountStatusReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("LOCKED"));

        // An Owner cannot manage staff through another location's scope.
        var foreignLocation = fixtureLocation(fixtureAccount("other_" + uniqueSuffix, Role.OWNER));
        mockMvc.perform(get("/api/owner/staff-members").header("Authorization", "Bearer " + ownerToken)
                .header("X-Location-Id", foreignLocation.getId())).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/owner/locations/" + foreignLocation.getId() + "/courts")
                .header("Authorization", "Bearer " + ownerToken)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/owner/staff-members").header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/owner/staff-members").header("Authorization", "Bearer " + ownerToken)
                .header("X-Location-Id", "bad")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/accounts").header("Authorization", "Bearer " + playerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/owner/vouchers").header("Authorization", "Bearer " + playerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/accounts?sortBy=missing").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/accounts?role=invalid").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/accounts?status=invalid").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch("/api/owner/staff-members/" + createdStaffId + "/status")
                .header("Authorization", "Bearer " + ownerToken).header("X-Location-Id", location.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIVE\"}"))
                .andExpect(status().isForbidden());
        var secondAdmin = fixtureAccount("admin2_" + uniqueSuffix, Role.ADMIN);
        mockMvc.perform(patch("/api/admin/accounts/" + secondAdmin.getId() + "/status")
                .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"LOCKED\"}")).andExpect(status().isBadRequest());

        // Separate password endpoint and immutable profile phone.
        mockMvc.perform(post("/api/users/me/password").header("Authorization", "Bearer " + playerToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"wrong\",\"newPassword\":\"Changed123\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Mật khẩu hiện tại không chính xác (MSG113)"));
        mockMvc.perform(post("/api/users/me/password").header("Authorization", "Bearer " + playerToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"NewPassword123@\",\"newPassword\":\"Changed123\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Đổi mật khẩu thành công (MSG114)"));
        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + playerToken))
                .andExpect(status().isUnauthorized());
        playerToken = jwtTokenProvider.generateToken(accountRepository.findByEmail(testEmail).orElseThrow());
        mockMvc.perform(patch("/api/users/me").header("Authorization", "Bearer " + playerToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"phone\":\"0123456789\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.phone").value(testPhone));

        mockMvc.perform(patch("/api/owner/staff-members/" + createdStaffId + "/status")
                .header("Authorization", "Bearer " + ownerToken).header("X-Location-Id", location.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"LOCKED\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/owner/staff-members/" + createdStaffId + "/password")
                .header("Authorization", "Bearer " + ownerToken).header("X-Location-Id", location.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"newPassword\":\"ResetStaff123\"}"))
                .andExpect(status().isOk());
        Account staff = accountRepository.findById(createdStaffId).orElseThrow();
        assertThat(passwordEncoder.matches("ResetStaff123", staff.getPasswordHash())).isTrue();
        staff.setStatus(AccountStatus.ACTIVE);
        accountRepository.saveAndFlush(staff);
        String staffToken = jwtTokenProvider.generateToken(staff);
        mockMvc.perform(post("/api/users/me/password").header("Authorization", "Bearer " + staffToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"ResetStaff123\",\"newPassword\":\"Changed123\"}"))
                .andExpect(status().isForbidden());
        location.setStatus("LOCKED");
        locationRepository.saveAndFlush(location);
        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + staffToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest(staff.getUsername(), "ResetStaff123"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/owner/staff-members").header("Authorization", "Bearer " + ownerToken)
                .header("X-Location-Id", location.getId())).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/owner/exports").header("Authorization", "Bearer " + ownerToken)
                .header("X-Location-Id", location.getId())).andExpect(status().isNotImplemented());
    }

    @Test
    void publicReadsAndSwaggerAreAccessibleButWritesRequireAuthentication() throws Exception {
        for (String path : java.util.List.of("/api/locations", "/api/courts/1", "/api/courts/1/reviews")) {
            mockMvc.perform(get(path)).andExpect(status().isNotImplemented());
        }
        mockMvc.perform(get("/api/matches")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());
        mockMvc.perform(get("/api/matches/9223372036854775807")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/matches")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/matches/1/join-requests")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/owner/staff-members']").exists())
                .andExpect(jsonPath("$.paths['/api/users/me/password']").exists())
                .andExpect(jsonPath("$.paths['/api/admin/vouchers/{id}/disable']").exists())
                .andExpect(jsonPath("$.paths['/api/owner/refunds']").exists())
                .andExpect(jsonPath("$.paths['/api/bookings/summary']").exists())
                .andExpect(jsonPath("$.paths['/api/booking-quotes']").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/bookings/{id}/apply-voucher']").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/bookings/{id}/apply-points']").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/staff']").doesNotExist());
        mockMvc.perform(get("/swagger-ui")).andExpect(status().is3xxRedirection());
    }

    private Account fixtureAccount(String username, Role role) {
        return accountRepository.saveAndFlush(Account.builder().username(username).email(username + "@example.com")
                .phone("09" + (10000000 + new java.security.SecureRandom().nextInt(90000000)))
                .fullName("Người Kiểm Thử").passwordHash(passwordEncoder.encode("Password123"))
                .role(role).status(AccountStatus.ACTIVE).build());
    }

    @Test
    void mergedEntitiesCanReadTheExistingSchema() {
        var entities = entityManager.getMetamodel().getEntities();
        assertThat(entities).hasSize(37);
        for (var entity : entities) {
            entityManager.createQuery("select e from " + entity.getName() + " e", entity.getJavaType())
                    .setMaxResults(1).getResultList();
        }
    }

    @Test
    void mergedTeamApisCreateJoinAndApproveWithCaptainAuthorization() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account captain = fixtureAccount("captain_" + suffix, Role.PLAYER);
        Account applicant = fixtureAccount("member_" + suffix, Role.PLAYER);
        String captainToken = jwtTokenProvider.generateToken(captain);
        String applicantToken = jwtTokenProvider.generateToken(applicant);
        var created = mockMvc.perform(post("/api/teams").header("Authorization", "Bearer " + captainToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Team " + suffix + "\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.memberCount").value(1)).andReturn();
        long teamId = objectMapper.readTree(created.getResponse().getContentAsString()).at("/data/id").asLong();
        var joined = mockMvc.perform(post("/api/teams/" + teamId + "/join-requests")
                .header("Authorization", "Bearer " + applicantToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"phoneConsent\":true}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.status").value("PENDING")).andReturn();
        long requestId = objectMapper.readTree(joined.getResponse().getContentAsString()).at("/data/id").asLong();
        mockMvc.perform(post("/api/team-join-requests/" + requestId + "/approve")
                .header("Authorization", "Bearer " + applicantToken)).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/team-join-requests/" + requestId + "/approve")
                .header("Authorization", "Bearer " + captainToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
        mockMvc.perform(get("/api/teams/" + teamId + "/members")
                .header("Authorization", "Bearer " + applicantToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    private com.sep490.bms.entity.Location fixtureLocation(Account owner) {
        return locationRepository.saveAndFlush(com.sep490.bms.entity.Location.builder().ownerId(owner.getId())
                .name("Địa điểm kiểm thử").address("Hà Nội").contactPhone("0987654321")
                .latitude(java.math.BigDecimal.ONE).longitude(java.math.BigDecimal.ONE).build());
    }
}
