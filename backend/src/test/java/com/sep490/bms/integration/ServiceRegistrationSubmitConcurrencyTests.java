package com.sep490.bms.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.service.integration.FileStorageService;

/**
 * D181: bước "Kiểm tra thông tin" không giữ email, số điện thoại, nên hai chủ sân có thể cùng qua bước này.
 * Khi gửi, submit() khóa email và số điện thoại (sp_getapplock tới hết transaction) rồi mới kiểm tra lại.
 * Test chạy API thật, hai transaction SQL riêng trên BMS_Test: giữ đơn thứ nhất ngay sau khi đã khóa,
 * đơn thứ hai phải chờ, đơn thứ nhất lưu xong thì đơn thứ hai bị chặn (409). Xóa dữ liệu tạo ra theo email.
 */
@SpringBootTest(properties = {"bms.job.enabled=false", "app.booking-change.jobs-enabled=false",
        "bms.scheduler.match-sweep.enabled=false", "app.upload.dir=target/service-registration-test-uploads"})
class ServiceRegistrationSubmitConcurrencyTests {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @MockitoSpyBean FileStorageService files;
    MockMvc mvc;
    String suffix;
    final List<String> emails = new ArrayList<>();

    @BeforeEach void setup() throws Exception {
        try (var connection = jdbc.getDataSource().getConnection()) {
            assertThat(connection.getCatalog()).isEqualToIgnoringCase("BMS_Test");
        }
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    @AfterEach void cleanup() {
        for (String email : emails) {
            jdbc.update("DELETE FROM notification WHERE ref_type = 'SERVICE_REGISTRATION' AND ref_id IN "
                    + "(SELECT id FROM service_registration WHERE contact_email = ?)", email);
            jdbc.update("DELETE FROM service_registration WHERE contact_email = ?", email);
        }
    }

    @Test void sameEmailSubmittedAtOnceKeepsOnlyOnePendingRequest() throws Exception {
        String email = "c" + suffix + "@example.com";
        onlyFirstAccepted(form(email, phone()), form(email, phone()));
        assertThat(pending("contact_email", email)).isEqualTo(1);
    }

    @Test void samePhoneSubmittedAtOnceKeepsOnlyOnePendingRequest() throws Exception {
        String phone = phone();
        onlyFirstAccepted(form("p1" + suffix + "@example.com", phone), form("p2" + suffix + "@example.com", phone));
        assertThat(pending("contact_phone", phone)).isEqualTo(1);
    }

    /** Đơn thứ nhất dừng ở bước lưu ảnh (đã qua kiểm tra, đang giữ khóa); đơn thứ hai gửi đúng lúc đó. */
    private void onlyFirstAccepted(Map<String, Object> first, Map<String, Object> second) throws Exception {
        CountDownLatch firstHoldsLock = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicBoolean firstCall = new AtomicBoolean(true);
        doAnswer(invocation -> {
            if (firstCall.getAndSet(false)) {
                firstHoldsLock.countDown();
                assertThat(release.await(20, TimeUnit.SECONDS)).isTrue();
            }
            return invocation.callRealMethod();
        }).when(files).storeImage(any(), eq("service-registration-proofs"));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> a = pool.submit(() -> submit(first));
            assertThat(firstHoldsLock.await(10, TimeUnit.SECONDS)).isTrue();
            Future<Integer> b = pool.submit(() -> submit(second));
            // Khóa đúng thì đơn thứ hai phải đứng chờ, không được tự qua kiểm tra trong lúc đơn thứ nhất chưa lưu.
            assertThatThrownBy(() -> b.get(500, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            release.countDown();
            assertThat(List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsExactly(201, 409);
        } finally {
            release.countDown();
            pool.shutdown();
            assertThat(pool.awaitTermination(25, TimeUnit.SECONDS)).isTrue();
        }
    }

    private int submit(Map<String, Object> form) throws Exception {
        return mvc.perform(multipart("/api/service-registrations")
                        .file(new MockMultipartFile("data", "", "application/json", json.writeValueAsBytes(form)))
                        .file(new MockMultipartFile("proof", "ck.png", "image/png", new byte[] {1, 2, 3})))
                .andReturn().getResponse().getStatus();
    }

    private Integer pending(String column, String value) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM service_registration WHERE status = 'PENDING' AND "
                + column + " = ?", Integer.class, value);
    }

    private Map<String, Object> form(String email, String phone) {
        emails.add(email);
        Map<String, Object> form = new HashMap<>();
        form.put("locationName", "Sân thử đồng thời " + suffix);
        form.put("address", "1 Đường thử, Hà Nội");
        form.put("latitude", 21.0);
        form.put("longitude", 105.8);
        form.put("courtCount", 4);
        form.put("rentalYears", 1);
        form.put("termsAccepted", true);
        form.put("contactName", "Chủ sân thử");
        form.put("contactPhone", phone);
        form.put("contactEmail", email);
        return form;
    }

    private static String phone() {
        return "0" + String.format("%09d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 1000000000L));
    }
}
