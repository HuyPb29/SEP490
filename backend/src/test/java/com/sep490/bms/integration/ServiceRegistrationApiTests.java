package com.sep490.bms.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.security.JwtTokenProvider;
import com.sep490.bms.service.integration.EmailService;

/**
 * D168, D169 qua API thật trên BMS_Test (dữ liệu rollback): form multipart, QR bên vận hành,
 * ảnh chứng từ chỉ Admin xem, duyệt tạo Owner và gửi MSG116. Cần migration 20261119_d168_service_registration.sql.
 */
@SpringBootTest(properties = {"bms.job.enabled=false", "app.booking-change.jobs-enabled=false",
        "bms.scheduler.match-sweep.enabled=false", "app.upload.dir=target/service-registration-test-uploads"})
@Transactional
class ServiceRegistrationApiTests {

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired AccountRepository accounts;
    @Autowired JwtTokenProvider jwt;
    @MockitoBean EmailService mail;

    MockMvc mvc;
    Account admin;
    String suffix;

    @BeforeEach
    void setUp() throws Exception {
        try (var c = Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
            assertThat(c.getCatalog()).isEqualToIgnoringCase("BMS_Test");
        }
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        admin = accounts.saveAndFlush(Account.builder().username("a" + suffix).email("a" + suffix + "@example.com")
                .phone(phone()).fullName("Admin test").passwordHash("unused").role(Role.ADMIN)
                .status(AccountStatus.ACTIVE).build());
    }

    @Test
    void guestSeesOperatorPaymentInfoAndDefaultQrWithoutLogin() throws Exception {
        mvc.perform(get("/api/service-registrations/payment-info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bankAccountNo").isNotEmpty())
                .andExpect(jsonPath("$.data.referenceFee").value(10000000))
                .andExpect(jsonPath("$.data.referenceCourts").value(9));
        mvc.perform(get("/api/service-registrations/payment-info/qr"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"));
    }

    @Test
    void guestSubmitsMultipartThenAdminSeesProofAndApprovesWithEmail() throws Exception {
        String email = "g" + suffix + "@example.com";
        var sent = mvc.perform(multipart("/api/service-registrations")
                        .file(data(form(email, true)))
                        .file(new MockMultipartFile("proof", "ck.png", "image/png", new byte[] {1, 2, 3})))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value(
                        "Đã gửi yêu cầu đăng ký. Sau khi kiểm tra tiền thuê đã về, chúng tôi sẽ gửi kết quả tới email "
                                + email + "."))
                .andExpect(jsonPath("$.data.rentalYears").value(2))
                .andExpect(jsonPath("$.data.rentalAmount").value(8889000))
                .andExpect(jsonPath("$.data.hasProof").value(true))
                .andReturn();
        long id = json.readTree(sent.getResponse().getContentAsString()).at("/data/id").asLong();

        // Ảnh chứng từ chỉ Admin xem được.
        mvc.perform(get("/api/admin/service-registrations/" + id + "/proof")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/service-registrations/" + id + "/proof").header("Authorization", token(admin)))
                .andExpect(status().isOk())
                .andExpect(content().bytes(new byte[] {1, 2, 3}));

        var approved = mvc.perform(post("/api/admin/service-registrations/" + id + "/approve")
                        .header("Authorization", token(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andReturn();
        long locationId = json.readTree(approved.getResponse().getContentAsString()).at("/data/locationId").asLong();

        ArgumentCaptor<String> username = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> password = ArgumentCaptor.forClass(String.class);
        LocalDate today = LocalDate.now();
        String end = today.plusYears(2).minusDays(1).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        verify(mail).sendServiceRegistrationApproved(eq(email), eq("Sân thử D168 " + suffix), eq(4),
                eq("8.889.000"), anyString(), eq(end), username.capture(), anyString());
        Account owner = accounts.findByUsername(username.getValue()).orElseThrow();
        assertThat(owner.getRole()).isEqualTo(Role.OWNER);
        assertThat(owner.getEmail()).isEqualTo(email);
        // FR12: thời hạn từ ngày duyệt theo số năm thuê trong đơn (2 năm), không còn cứng 12 tháng.
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM service_term WHERE location_id = ? "
                + "AND start_date = ? AND end_date = ?", Integer.class,
                locationId, today, today.plusYears(2).minusDays(1))).isEqualTo(1);
    }

    @Test
    void submissionWithoutTermsOrProofIsRejected() throws Exception {
        String email = "t" + suffix + "@example.com";
        mvc.perform(multipart("/api/service-registrations")
                        .file(data(form(email, false)))
                        .file(new MockMultipartFile("proof", "ck.png", "image/png", new byte[] {1})))
                .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/service-registrations").file(data(form(email, true))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void adminUpdatesOperatorPaymentInfoButOthersCannot() throws Exception {
        String body = json.writeValueAsString(Map.of(
                "bankName", "Vietcombank", "bankAccountNo", "999888777", "bankAccountHolder", "BMS TEST"));
        mvc.perform(put("/api/admin/operator-payment-info").contentType("application/json").content(body))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/admin/operator-payment-info").header("Authorization", token(admin))
                        .contentType("application/json").content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bankAccountNo").value("999888777"));
        mvc.perform(get("/api/service-registrations/payment-info"))
                .andExpect(jsonPath("$.data.bankName").value("Vietcombank"));
    }

    @Test
    void rejectingSendsReasonEmail() throws Exception {
        String email = "r" + suffix + "@example.com";
        var sent = mvc.perform(multipart("/api/service-registrations")
                        .file(data(form(email, true)))
                        .file(new MockMultipartFile("proof", "ck.jpg", "image/jpeg", new byte[] {1})))
                .andExpect(status().isCreated()).andReturn();
        long id = json.readTree(sent.getResponse().getContentAsString()).at("/data/id").asLong();

        mvc.perform(post("/api/admin/service-registrations/" + id + "/reject").header("Authorization", token(admin))
                        .contentType("application/json").content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT status FROM service_registration WHERE id = ?", String.class, id))
                .isEqualTo("PENDING");

        mvc.perform(post("/api/admin/service-registrations/" + id + "/reject").header("Authorization", token(admin))
                        .contentType("application/json").content("{\"reason\":\"Chưa nhận được tiền thuê\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.rejectReason").value("Chưa nhận được tiền thuê"));
        verify(mail).sendServiceRegistrationRejected(email, "Sân thử D168 " + suffix, "Chưa nhận được tiền thuê");
        var retry = form(email, true);
        retry.put("contactPhone", jdbc.queryForObject("SELECT contact_phone FROM service_registration WHERE id=?", String.class, id));
        submit(retry, 201);
        org.mockito.Mockito.verify(mail, org.mockito.Mockito.never()).sendServiceRegistrationApproved(
                anyString(), anyString(), anyInt(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void invalidAndDuplicateContactsDoNotAddPendingRequests() throws Exception {
        var original = form("duplicate" + suffix + "@example.com", true);
        submit(original, 201);
        int before = jdbc.queryForObject("SELECT COUNT(*) FROM service_registration WHERE status='PENDING'", Integer.class);
        var sameEmail = new HashMap<>(original);
        sameEmail.put("contactEmail", original.get("contactEmail").toString().toUpperCase());
        sameEmail.put("contactPhone", phone());
        submit(sameEmail, 409);
        var samePhone = new HashMap<>(original);
        samePhone.put("contactEmail", "other" + suffix + "@example.com");
        submit(samePhone, 409);
        var existingAccount = form(admin.getEmail(), true);
        submit(existingAccount, 409);
        existingAccount.put("contactEmail", "new" + suffix + "@example.com");
        existingAccount.put("contactPhone", admin.getPhone());
        submit(existingAccount, 409);
        for (var invalid : java.util.List.of(Map.of("contactEmail", "invalid@localhost"),
                Map.of("contactPhone", "12345"), Map.of("contactName", "  "),
                Map.of("latitude", "91"), Map.of("termsAccepted", false))) {
            var candidate = form("invalid" + suffix + "@example.com", true);
            candidate.putAll(invalid);
            submit(candidate, 400);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM service_registration WHERE status='PENDING'", Integer.class))
                .isEqualTo(before);
        mvc.perform(get("/api/admin/service-registrations").param("status", "PENDING")
                        .header("Authorization", token(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(before));
    }

    private void submit(Map<String, Object> form, int expectedStatus) throws Exception {
        mvc.perform(multipart("/api/service-registrations").file(data(form))
                        .file(new MockMultipartFile("proof", "ck.png", "image/png", new byte[] {1})))
                .andExpect(status().is(expectedStatus));
    }

    private Map<String, Object> form(String email, boolean termsAccepted) {
        Map<String, Object> form = new HashMap<>();
        form.put("locationName", "Sân thử D168 " + suffix);
        form.put("address", "1 Đường thử, Hà Nội");
        form.put("latitude", 21.0);
        form.put("longitude", 105.8);
        form.put("courtCount", 4);
        form.put("rentalYears", 2);
        form.put("termsAccepted", termsAccepted);
        form.put("contactName", "Chủ sân thử");
        form.put("contactPhone", phone());
        form.put("contactEmail", email);
        return form;
    }

    private MockMultipartFile data(Map<String, Object> form) throws Exception {
        return new MockMultipartFile("data", "", "application/json", json.writeValueAsBytes(form));
    }

    private String token(Account account) {
        return "Bearer " + jwt.generateToken(account);
    }

    private static String phone() {
        return "0" + String.format("%09d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 1000000000L));
    }
}
