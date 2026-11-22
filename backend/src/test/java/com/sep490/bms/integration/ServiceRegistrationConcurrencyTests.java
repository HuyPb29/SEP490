package com.sep490.bms.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.sep490.bms.entity.account.*;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.ServiceRegistration;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.ServiceRegistrationRepository;
import com.sep490.bms.security.JwtTokenProvider;
import com.sep490.bms.service.integration.EmailService;

/** Hai tab gọi API thật, hai transaction SQL riêng; chỉ chạy trên BMS_Test và xóa fixture theo ID. */
@SpringBootTest(properties = {"bms.job.enabled=false", "app.booking-change.jobs-enabled=false",
        "bms.scheduler.match-sweep.enabled=false"})
class ServiceRegistrationConcurrencyTests {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired AccountRepository accounts;
    @Autowired ServiceRegistrationRepository registrations;
    @Autowired JwtTokenProvider jwt;
    @MockitoBean EmailService mail;
    MockMvc mvc;
    Account admin;
    ServiceRegistration request;
    String suffix;

    @BeforeEach void setup() throws Exception {
        try (var connection = jdbc.getDataSource().getConnection()) {
            assertThat(connection.getCatalog()).isEqualToIgnoringCase("BMS_Test");
        }
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        admin = accounts.saveAndFlush(Account.builder().username("a" + suffix).email("a" + suffix + "@example.com")
                .phone(phone()).fullName("Admin fixture UC06").passwordHash("unused")
                .role(Role.ADMIN).status(AccountStatus.ACTIVE).build());
        request = registrations.saveAndFlush(ServiceRegistration.builder().locationName("Fixture UC06 " + suffix)
                .address("1 Đường kiểm thử, Hà Nội").latitude(BigDecimal.valueOf(21))
                .longitude(BigDecimal.valueOf(105)).courtCount(2).rentalYears(1).rentalAmount(BigDecimal.valueOf(2223000))
                .proofImagePath("fixture.png").termsAcceptedAt(java.time.LocalDateTime.now())
                .contactName("Chủ sân fixture").contactEmail(suffix + "@example.com").contactPhone(phone())
                .status(ApprovalStatus.PENDING).build());
    }

    @AfterEach void cleanup() {
        if (request != null) {
            var row = registrations.findById(request.getId()).orElseThrow();
            Long locationId = row.getLocationId();
            Long ownerId = row.getRequesterId();
            registrations.deleteById(request.getId());
            if (locationId != null) {
                jdbc.update("DELETE FROM service_term WHERE location_id=?", locationId);
                jdbc.update("DELETE FROM court WHERE location_id=?", locationId);
                jdbc.update("DELETE FROM location WHERE id=?", locationId);
            }
            if (ownerId != null) accounts.deleteById(ownerId);
        }
        if (admin != null) accounts.deleteById(admin.getId());
    }

    @Test void twoTabsApproveOnlyOnceAndRetryCannotCreateAnotherOwnerOrLocation() throws Exception {
        CountDownLatch emailReached = new CountDownLatch(1);
        CountDownLatch releaseEmail = new CountDownLatch(1);
        doAnswer(call -> {
            emailReached.countDown();
            assertThat(releaseEmail.await(10, TimeUnit.SECONDS)).isTrue();
            return null;
        }).when(mail).sendServiceRegistrationApproved(anyString(), anyString(), anyInt(), anyString(),
                anyString(), anyString(), anyString(), anyString());
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = pool.submit(this::approve);
            assertThat(emailReached.await(10, TimeUnit.SECONDS)).isTrue();
            Future<Integer> second = pool.submit(this::approve);
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> second.get(200, TimeUnit.MILLISECONDS))
                    .isInstanceOf(TimeoutException.class);
            releaseEmail.countDown();
            assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(approve()).isEqualTo(409);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM location WHERE name=?", Integer.class,
                    request.getLocationName())).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM account WHERE email=?", Integer.class,
                    request.getContactEmail())).isEqualTo(1);
            verify(mail, times(1)).sendServiceRegistrationApproved(anyString(), anyString(), anyInt(), anyString(),
                    anyString(), anyString(), anyString(), anyString());
        } finally {
            releaseEmail.countDown();
            pool.shutdown();
            assertThat(pool.awaitTermination(25, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test void failedRejectionEmailRollsBackStatusAndReason() throws Exception {
        doThrow(new com.sep490.bms.exception.AppException("Không gửi được email",
                org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE))
                .when(mail).sendServiceRegistrationRejected(anyString(), anyString(), anyString());
        assertThat(mvc.perform(post("/api/admin/service-registrations/" + request.getId() + "/reject")
                .header("Authorization", "Bearer " + jwt.generateToken(admin)).contentType("application/json")
                .content("{\"reason\":\"Thông tin không hợp lệ\"}")).andReturn().getResponse().getStatus()).isEqualTo(503);
        var stored = registrations.findById(request.getId()).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(ApprovalStatus.PENDING);
        assertThat(stored.getRejectReason()).isNull();
        assertThat(stored.getProcessedAt()).isNull();
    }

    private int approve() throws Exception {
        return mvc.perform(post("/api/admin/service-registrations/" + request.getId() + "/approve")
                .header("Authorization", "Bearer " + jwt.generateToken(admin)))
                .andReturn().getResponse().getStatus();
    }
    private static String phone() {
        return "0" + String.format("%09d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 1_000_000_000L));
    }
}
