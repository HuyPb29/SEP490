package com.sep490.bms.controller.location;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.sep490.bms.dto.booking.BatchOfferPublicResponse;
import com.sep490.bms.dto.booking.ScheduleResponse;
import com.sep490.bms.dto.location.CourtResponse;
import com.sep490.bms.dto.location.LocationDetailResponse;
import com.sep490.bms.dto.location.LocationSummaryResponse;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.exception.GlobalExceptionHandler;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.PackageService;
import com.sep490.bms.service.booking.ScheduleService;
import com.sep490.bms.service.location.CourtQueryService;
import com.sep490.bms.service.location.LocationQueryService;

/**
 * API công khai của F3 (UC11 tìm địa điểm, UC12 thông tin sân, UC13 lịch sân, UC15 chương trình theo lô):
 * Guest gọi được không cần đăng nhập, tham số đi đúng vào service, tham số sai kiểu báo 400.
 */
class PublicLocationControllersTests {

    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final PackageService packages = mock(PackageService.class);
    private final CourtQueryService courts = mock(CourtQueryService.class);
    private final ScheduleService schedules = mock(ScheduleService.class);
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new LocationController(locations, packages),
                        new CourtController(courts), new ScheduleController(schedules))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // ---- UC11 ----

    @Test
    void guestSearchesByKeywordAndPosition() throws Exception {
        when(locations.search("linh dam", 20.97, 105.83)).thenReturn(List.of(
                LocationSummaryResponse.builder().id(1L).name("Sân Linh Đàm").build()));

        mvc.perform(get("/api/locations").param("q", "linh dam").param("lat", "20.97").param("lng", "105.83"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("Sân Linh Đàm"));
    }

    @Test
    void searchWithoutFiltersPassesNulls() throws Exception {
        when(locations.search(null, null, null)).thenReturn(List.of());

        mvc.perform(get("/api/locations")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty());
        verify(locations).search(null, null, null);
    }

    @Test
    void nonNumericCoordinateIs400() throws Exception {
        mvc.perform(get("/api/locations").param("lat", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Giá trị của tham số lat không hợp lệ"));
        verifyNoInteractions(locations);
    }

    // ---- UC12 ----

    @Test
    void guestReadsLocationDetailAndCourts() throws Exception {
        when(locations.detail(1L)).thenReturn(LocationDetailResponse.builder().id(1L).name("Sân Linh Đàm").build());
        when(courts.listActive(1L)).thenReturn(List.of(CourtResponse.builder().id(5L).name("Sân 1").build()));
        when(courts.detail(5L)).thenReturn(CourtResponse.builder().id(5L).name("Sân 1").build());

        mvc.perform(get("/api/locations/1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Sân Linh Đàm"));
        mvc.perform(get("/api/locations/1/courts")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("Sân 1"));
        mvc.perform(get("/api/courts/5")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(5));
    }

    @Test
    void missingLocationKeepsNotFoundMessage() throws Exception {
        when(locations.detail(99L)).thenThrow(new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));

        mvc.perform(get("/api/locations/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Không tìm thấy địa điểm"));
    }

    @Test
    void nonNumericIdIs400() throws Exception {
        mvc.perform(get("/api/courts/abc")).andExpect(status().isBadRequest());
        verifyNoInteractions(courts);
    }

    // ---- UC15 #9 ----

    @Test
    void guestSeesRunningBatchOffers() throws Exception {
        when(packages.listActiveBatchOffers(1L)).thenReturn(List.of(
                BatchOfferPublicResponse.builder().id(3L).name("Hè sôi động").build()));

        mvc.perform(get("/api/locations/1/batch-offers")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("Hè sôi động"));
    }

    // ---- UC13 ----

    @Test
    void guestScheduleDefaultsToTodayAndNoViewer() throws Exception {
        when(schedules.schedule(1L, null, null, null, false)).thenReturn(ScheduleResponse.builder()
                .date(LocalDate.of(2026, 11, 26)).courts(List.of()).build());

        mvc.perform(get("/api/locations/1/schedules")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.courts").isEmpty());
        verify(schedules).schedule(1L, null, null, null, false);
    }

    @Test
    void loggedInPlayerSchedulePassesDateRescheduleAndPackageFlags() throws Exception {
        UserPrincipal player = UserPrincipal.builder().id(7L).role(Role.PLAYER).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                player, null, AuthorityUtils.createAuthorityList("ROLE_PLAYER")));
        when(schedules.schedule(any(), any(), any(), any(), anyBoolean())).thenReturn(new ScheduleResponse());

        mvc.perform(get("/api/locations/1/schedules").param("date", "2026-12-01").param("bookingId", "11"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/locations/1/schedules").param("date", "2026-12-01").param("forPackage", "true"))
                .andExpect(status().isOk());

        verify(schedules).schedule(1L, LocalDate.of(2026, 12, 1), player, 11L, false);
        verify(schedules).schedule(1L, LocalDate.of(2026, 12, 1), player, null, true);
    }

    @Test
    void badScheduleDateIs400() throws Exception {
        mvc.perform(get("/api/locations/1/schedules").param("date", "30/11/2026"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Giá trị của tham số date không hợp lệ"));
        verifyNoInteractions(schedules);
    }
}
