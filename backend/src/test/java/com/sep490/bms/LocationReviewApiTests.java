package com.sep490.bms;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import com.sep490.bms.entity.Location;
import com.sep490.bms.repository.LocationRepository;

/** F8 UC12 – đánh giá công khai theo địa điểm: khách chưa đăng nhập xem được, đánh giá bị ẩn không tính. */
@SpringBootTest
@Transactional
class LocationReviewApiTests {

    @Autowired WebApplicationContext context;
    @Autowired LocationRepository locations;
    @Autowired JdbcTemplate jdbc;

    MockMvc mvc;
    Long playerId;
    Long locationId;
    Long courtA;
    Long courtB;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        playerId = account("PLAYER");
        locationId = locations.saveAndFlush(Location.builder().ownerId(account("OWNER")).name("Review test")
                .address("Test").contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE)
                .build()).getId();
        courtA = court("A");
        courtB = court("B");
    }

    @Test
    void guestSeesSummaryOfVisibleReviewsAcrossAllCourts() throws Exception {
        review(courtA, 5, false);
        review(courtB, 4, false);
        review(courtA, 1, true);

        mvc.perform(get("/api/locations/{id}/review-summary", locationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewCount").value(2))
                .andExpect(jsonPath("$.data.averageRating").value(4.5))
                .andExpect(jsonPath("$.data.ratingCounts.5").value(1))
                .andExpect(jsonPath("$.data.ratingCounts.4").value(1))
                .andExpect(jsonPath("$.data.ratingCounts.1").value(0));
        mvc.perform(get("/api/locations/{id}/reviews", locationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.content[0].locationId").value(locationId));
    }

    @Test
    void locationWithoutReviewsHasNoAverage() throws Exception {
        mvc.perform(get("/api/locations/{id}/review-summary", locationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewCount").value(0))
                .andExpect(jsonPath("$.data.averageRating").doesNotExist());
    }

    @Test
    void unknownLocationReturnsNotFound() throws Exception {
        mvc.perform(get("/api/locations/{id}/review-summary", Long.MAX_VALUE)).andExpect(status().isNotFound());
        mvc.perform(get("/api/locations/{id}/reviews", Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    // ---------------------------------------------------------------- fixtures

    private Long account(String role) {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String phone = "0" + String.format("%09d", Math.floorMod((long) id.hashCode(), 1000000000L));
        jdbc.update("""
                INSERT INTO account (username, email, phone, full_name, password_hash, role, status)
                VALUES (?, ?, ?, 'Review Test', 'test-unused', ?, 'ACTIVE')
                """, "v" + id, id + "@example.com", phone, role);
        return jdbc.queryForObject("SELECT id FROM account WHERE username = ?", Long.class, "v" + id);
    }

    private Long court(String name) {
        jdbc.update("INSERT INTO court (location_id, name, is_active) VALUES (?, ?, 1)", locationId, name);
        return jdbc.queryForObject("SELECT id FROM court WHERE location_id = ? AND name = ?", Long.class,
                locationId, name);
    }

    private void review(Long courtId, int rating, boolean hidden) {
        String code = "V" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        jdbc.update("""
                INSERT INTO booking (booking_code, booking_type, location_id, court_id, player_id, play_date,
                    start_minute, end_minute, list_amount, final_amount, status)
                VALUES (?, 'SINGLE', ?, ?, ?, ?, 480, 540, 100000, 100000, 'COMPLETED')
                """, code, locationId, courtId, playerId, java.sql.Date.valueOf(LocalDate.now().minusDays(1)));
        Long booking = jdbc.queryForObject("SELECT id FROM booking WHERE booking_code = ?", Long.class, code);
        jdbc.update("INSERT INTO review (booking_id, location_id, player_id, rating, is_hidden) VALUES (?, ?, ?, ?, ?)",
                booking, locationId, playerId, rating, hidden);
    }
}
