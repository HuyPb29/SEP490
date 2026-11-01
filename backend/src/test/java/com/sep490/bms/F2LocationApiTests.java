package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.AccountStatus;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.OpeningExceptionRepository;
import com.sep490.bms.repository.location.OpeningHourRepository;
import com.sep490.bms.security.JwtTokenProvider;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 *
 * Test tích hợp cho UC07 (địa điểm và sân) và UC08 (giờ mở cửa, ngày ngoại lệ).
 * Mỗi test tự tạo dữ liệu riêng và rollback sau khi xong, không phụ thuộc seed.
 */
@SpringBootTest
@Transactional
class F2LocationApiTests {

    private static final String OWNER_LOCATIONS = "/api/owner/locations";
    private static final String OPENING_HOURS = "/api/owner/locations/{id}/opening-hours";
    private static final String OPENING_EXCEPTIONS = "/api/owner/locations/{id}/opening-exceptions";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private LocationRepository locationRepository;

    @Autowired
    private CourtRepository courtRepository;

    @Autowired
    private OpeningHourRepository openingHourRepository;

    @Autowired
    private OpeningExceptionRepository openingExceptionRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private MockMvc mockMvc;

    private Account owner;
    private Account otherOwner;
    private Account player;
    private Location location;
    private Location otherLocation;
    private Court court;
    private String ownerToken;
    private String otherOwnerToken;
    private String playerToken;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        owner = createAccount(Role.OWNER, "OWNER");
        otherOwner = createAccount(Role.OWNER, "OWNER2");
        player = createAccount(Role.PLAYER, "PLAYER");

        location = createLocation(owner.getId(), "F2 Test Location A");
        otherLocation = createLocation(otherOwner.getId(), "F2 Test Location B");
        court = createCourt(location.getId(), "Court A1");

        ownerToken = jwtTokenProvider.generateToken(owner);
        otherOwnerToken = jwtTokenProvider.generateToken(otherOwner);
        playerToken = jwtTokenProvider.generateToken(player);
    }

    // ------------------------------------------------------------- UC07

    @Test
    void ownerSeesOnlyOwnLocations() throws Exception {
        mockMvc.perform(get(OWNER_LOCATIONS).header("Authorization", bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(location.getId()))
                .andExpect(jsonPath("$.data[0].name").value("F2 Test Location A"));
    }

    @Test
    void ownerCannotReadAnotherOwnersLocation() throws Exception {
        mockMvc.perform(get(OWNER_LOCATIONS + "/" + otherLocation.getId() + "/courts")
                        .header("Authorization", bearer(ownerToken)))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void playerCannotCallOwnerApi() throws Exception {
        mockMvc.perform(get(OWNER_LOCATIONS).header("Authorization", bearer(playerToken)))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void requestWithoutTokenIsRejected() throws Exception {
        mockMvc.perform(get(OWNER_LOCATIONS))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void updateLocationChangesProvidedFieldsOnly() throws Exception {
        mockMvc.perform(patch(OWNER_LOCATIONS + "/" + location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"advanceBookingDays\":45,\"contactPhone\":\"0912345678\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.advanceBookingDays").value(45))
                .andExpect(jsonPath("$.data.contactPhone").value("0912345678"))
                .andExpect(jsonPath("$.data.name").value("F2 Test Location A"));
    }

    @Test
    void updateLocationRejectsInvalidPhone() throws Exception {
        mockMvc.perform(patch(OWNER_LOCATIONS + "/" + location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contactPhone\":\"123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errors.contactPhone").exists());
    }

    @Test
    void createCourtAddsActiveCourt() throws Exception {
        mockMvc.perform(post(OWNER_LOCATIONS + "/" + location.getId() + "/courts")
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Court A2\",\"description\":\"San tham\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Court A2"))
                .andExpect(jsonPath("$.data.active").value(true));
    }

    @Test
    void createCourtRejectsDuplicateNameIgnoringCase() throws Exception {
        mockMvc.perform(post(OWNER_LOCATIONS + "/" + location.getId() + "/courts")
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"court a1\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("đã tồn tại")));
    }

    @Test
    void sameCourtNameIsAllowedInDifferentLocation() throws Exception {
        mockMvc.perform(post(OWNER_LOCATIONS + "/" + otherLocation.getId() + "/courts")
                        .header("Authorization", bearer(otherOwnerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Court A1\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void updateCourtCanDeactivate() throws Exception {
        mockMvc.perform(patch("/api/owner/courts/" + court.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isActive\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
    }

    // ------------------------------------------------------------- UC08 giờ mở cửa

    @Test
    void openingHoursAlwaysReturnSevenDays() throws Exception {
        mockMvc.perform(get(OPENING_HOURS, location.getId()).header("Authorization", bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(7))
                .andExpect(jsonPath("$.data[0].dayOfWeek").value(1))
                .andExpect(jsonPath("$.data[0].configured").value(false))
                .andExpect(jsonPath("$.data[6].dayOfWeek").value(7));
    }

    @Test
    void replaceOpeningHoursSavesFullWeek() throws Exception {
        mockMvc.perform(put(OPENING_HOURS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fullWeekJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(7))
                .andExpect(jsonPath("$.data[0].configured").value(true))
                .andExpect(jsonPath("$.data[0].openTime").value("06:00"))
                .andExpect(jsonPath("$.data[0].closeTime").value("23:30"))
                .andExpect(jsonPath("$.data[0].durationMinutes").value(1050))
                .andExpect(jsonPath("$.data[0].dayName").value("Thứ 2"));

        assertThat(openingHourRepository.findAllByLocationIdOrderByDayOfWeekAsc(location.getId())).hasSize(7);
    }

    @Test
    void replaceOpeningHoursRemovesDaysNotSent() throws Exception {
        mockMvc.perform(put(OPENING_HOURS, location.getId())
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(fullWeekJson()));

        mockMvc.perform(put(OPENING_HOURS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hours\":[{\"dayOfWeek\":1,\"openTime\":\"06:00\",\"closeTime\":\"22:00\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].configured").value(true))
                .andExpect(jsonPath("$.data[1].configured").value(false));

        assertThat(openingHourRepository.findAllByLocationIdOrderByDayOfWeekAsc(location.getId())).hasSize(1);
    }

    @Test
    void openingHoursAcceptTimeStringsAndMinutes() throws Exception {
        mockMvc.perform(put(OPENING_HOURS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hours\":[{\"dayOfWeek\":3,\"openMinute\":330,\"closeMinute\":1380},"
                                + "{\"dayOfWeek\":4,\"openTime\":\"07:30\",\"closeTime\":\"24:00\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[2].openTime").value("05:30"))
                .andExpect(jsonPath("$.data[3].openTime").value("07:30"))
                .andExpect(jsonPath("$.data[3].closeTime").value("24:00"));
    }

    @Test
    void openingHoursRejectCloseBeforeOpen() throws Exception {
        mockMvc.perform(put(OPENING_HOURS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hours\":[{\"dayOfWeek\":1,\"openMinute\":600,\"closeMinute\":540}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("sau giờ mở cửa")));
    }

    @Test
    void openingHoursRejectMinuteNotMultipleOfThirty() throws Exception {
        mockMvc.perform(put(OPENING_HOURS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hours\":[{\"dayOfWeek\":1,\"openMinute\":365,\"closeMinute\":600}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("bội số của 30 phút")));
    }

    @Test
    void openingHoursRejectDuplicateDay() throws Exception {
        mockMvc.perform(put(OPENING_HOURS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hours\":[{\"dayOfWeek\":1,\"openMinute\":360,\"closeMinute\":600},"
                                + "{\"dayOfWeek\":1,\"openMinute\":360,\"closeMinute\":660}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("trùng")));
    }

    @Test
    void openingHoursRejectEmptyList() throws Exception {
        mockMvc.perform(put(OPENING_HOURS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hours\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.hours").exists());
    }

    // ------------------------------------------------------------- UC08 ngày ngoại lệ

    @Test
    void createExceptionReturnsCreated() throws Exception {
        LocalDate date = LocalDate.now().plusDays(10);

        mockMvc.perform(post(OPENING_EXCEPTIONS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(exceptionJson(date, "08:00", "12:00")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.exceptionDate").value(date.toString()))
                .andExpect(jsonPath("$.data.openTime").value("08:00"))
                .andExpect(jsonPath("$.data.closeTime").value("12:00"))
                .andExpect(jsonPath("$.data.durationMinutes").value(240));
    }

    @Test
    void createExceptionRejectsDuplicateDate() throws Exception {
        LocalDate date = LocalDate.now().plusDays(11);
        mockMvc.perform(post(OPENING_EXCEPTIONS, location.getId())
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(exceptionJson(date, "08:00", "12:00")));

        mockMvc.perform(post(OPENING_EXCEPTIONS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(exceptionJson(date, "09:00", "10:00")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("đã có cấu hình")));
    }

    @Test
    void createExceptionRequiresDate() throws Exception {
        mockMvc.perform(post(OPENING_EXCEPTIONS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openMinute\":480,\"closeMinute\":720}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.exceptionDate").exists());
    }

    @Test
    void listExceptionsCanFilterByDateRange() throws Exception {
        LocalDate near = LocalDate.now().plusDays(5);
        LocalDate far = LocalDate.now().plusDays(60);
        mockMvc.perform(post(OPENING_EXCEPTIONS, location.getId())
                .header("Authorization", bearer(ownerToken)).contentType(MediaType.APPLICATION_JSON)
                .content(exceptionJson(near, "08:00", "12:00")));
        mockMvc.perform(post(OPENING_EXCEPTIONS, location.getId())
                .header("Authorization", bearer(ownerToken)).contentType(MediaType.APPLICATION_JSON)
                .content(exceptionJson(far, "08:00", "12:00")));

        mockMvc.perform(get(OPENING_EXCEPTIONS, location.getId())
                        .header("Authorization", bearer(ownerToken))
                        .param("from", far.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].exceptionDate").value(far.toString()));
    }

    @Test
    void updateExceptionChangesWindow() throws Exception {
        LocalDate date = LocalDate.now().plusDays(12);
        mockMvc.perform(post(OPENING_EXCEPTIONS, location.getId())
                .header("Authorization", bearer(ownerToken)).contentType(MediaType.APPLICATION_JSON)
                .content(exceptionJson(date, "08:00", "12:00")));

        Long exceptionId = openingExceptionRepository
                .findByLocationIdAndExceptionDate(location.getId(), date).orElseThrow().getId();

        mockMvc.perform(patch("/api/owner/opening-exceptions/" + exceptionId)
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"closeMinute\":780,\"note\":\"Sua gio\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.closeTime").value("13:00"))
                .andExpect(jsonPath("$.data.note").value("Sua gio"));
    }

    @Test
    void deleteExceptionThenNotFound() throws Exception {
        LocalDate date = LocalDate.now().plusDays(13);
        mockMvc.perform(post(OPENING_EXCEPTIONS, location.getId())
                .header("Authorization", bearer(ownerToken)).contentType(MediaType.APPLICATION_JSON)
                .content(exceptionJson(date, "08:00", "12:00")));

        Long exceptionId = openingExceptionRepository
                .findByLocationIdAndExceptionDate(location.getId(), date).orElseThrow().getId();

        mockMvc.perform(delete("/api/owner/opening-exceptions/" + exceptionId)
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId())))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/owner/opening-exceptions/" + exceptionId)
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId())))
                .andExpect(status().isNotFound());
    }

    @Test
    void ownerCannotTouchAnotherOwnersException() throws Exception {
        LocalDate date = LocalDate.now().plusDays(14);
        mockMvc.perform(post(OPENING_EXCEPTIONS, otherLocation.getId())
                .header("Authorization", bearer(otherOwnerToken)).contentType(MediaType.APPLICATION_JSON)
                .content(exceptionJson(date, "08:00", "12:00")));

        Long exceptionId = openingExceptionRepository
                .findByLocationIdAndExceptionDate(otherLocation.getId(), date).orElseThrow().getId();

        mockMvc.perform(patch("/api/owner/opening-exceptions/" + exceptionId)
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(otherLocation.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"hack\"}"))
                .andExpect(status().is4xxClientError());
    }

    // ------------------------------------------------------------- helpers

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String fullWeekJson() {
        StringBuilder sb = new StringBuilder("{\"hours\":[");
        for (int day = 1; day <= 7; day++) {
            if (day > 1) {
                sb.append(',');
            }
            sb.append("{\"dayOfWeek\":").append(day).append(",\"openMinute\":360,\"closeMinute\":1410}");
        }
        return sb.append("]}").toString();
    }

    private String exceptionJson(LocalDate date, String open, String close) {
        return "{\"exceptionDate\":\"" + date + "\",\"openTime\":\"" + open
                + "\",\"closeTime\":\"" + close + "\",\"note\":\"Test\"}";
    }

    /**
     * Tạo tài khoản test. Phải tuân ràng buộc của bảng account:
     * username bắt đầu bằng chữ thường, chỉ [a-z0-9._]; PLAYER/OWNER bắt buộc có email + phone 10 số.
     */
    private Account createAccount(Role role, String prefix) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = prefix.toLowerCase() + suffix;
        String phone = "09" + String.format("%08d", ThreadLocalRandom.current().nextInt(100_000_000));
        Account account = Account.builder()
                .username(username)
                .email(username + "@f2test.local")
                .phone(phone)
                .passwordHash("$2a$10$Ed6H/sJiKXsXTc.gjREbiO/l9iIoiShEmDjdEOI0zx5mrszl0FoGK")
                .fullName("F2 Test " + prefix)
                .role(role)
                .status(AccountStatus.ACTIVE)
                .createdAt(LocalDateTime.now())
                .build();
        return accountRepository.save(account);
    }

    private Location createLocation(Long ownerId, String name) {
        Location entity = Location.builder()
                .ownerId(ownerId)
                .name(name)
                .address("1 Test Street")
                .latitude(new BigDecimal("10.850000"))
                .longitude(new BigDecimal("106.750000"))
                .contactPhone("0900000001")
                .createdAt(LocalDateTime.now())
                .build();
        return locationRepository.save(entity);
    }

    private Court createCourt(Long locationId, String name) {
        return courtRepository.save(Court.builder()
                .locationId(locationId)
                .name(name)
                .active(true)
                .createdAt(LocalDateTime.now())
                .build());
    }
}
