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
                .andExpect(status().isOk());

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
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk());

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
        Account owner = accountRepository.findByEmail("owner.sunrise@bms.vn")
                .or(() -> accountRepository.findByEmail("owner.bms@example.com"))
                .orElseGet(() -> accountRepository.findAll().stream().filter(a -> a.getRole() == Role.OWNER).findFirst().orElseThrow());
        String ownerToken = jwtTokenProvider.generateToken(owner);

        Account admin = accountRepository.findByEmail("admin@bms.vn")
                .or(() -> accountRepository.findByEmail("admin.bms@example.com"))
                .orElseGet(() -> accountRepository.findAll().stream().filter(a -> a.getRole() == Role.ADMIN).findFirst().orElseThrow());
        String adminToken = jwtTokenProvider.generateToken(admin);

        // 10. GET /api/staff (as Owner)
        mockMvc.perform(get("/api/staff")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // 11. POST /api/staff (as Owner)
        String staffEmail = "staff_" + uniqueSuffix + "@example.com";
        CreateStaffRequest createStaffReq = CreateStaffRequest.builder()
                .email(staffEmail)
                .fullName("Nhân viên " + uniqueSuffix)
                .password("Staff123@")
                .phone("093" + (int)(1000000 + Math.random() * 9000000))
                .build();

        MvcResult createStaffResult = mockMvc.perform(post("/api/staff")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createStaffReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.email").value(staffEmail))
                .andReturn();

        JsonNode staffNode = objectMapper.readTree(createStaffResult.getResponse().getContentAsString());
        long createdStaffId = staffNode.get("data").get("id").asLong();

        // 12. PATCH /api/staff/{id}/status (as Owner)
        UpdateStatusRequest updateStaffStatusReq = UpdateStatusRequest.builder()
                .status("DISABLED")
                .build();

        mockMvc.perform(patch("/api/staff/" + createdStaffId + "/status")
                        .header("Authorization", "Bearer " + ownerToken)
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
    }
}
