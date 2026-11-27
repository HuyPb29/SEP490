package com.sep490.bms.controller.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.booking.BookingDetailResponse;
import com.sep490.bms.dto.booking.BookingListItem;
import com.sep490.bms.dto.booking.BookingOrderRequest;
import com.sep490.bms.dto.booking.BookingResponse;
import com.sep490.bms.dto.booking.BookingSummaryResponse;
import com.sep490.bms.dto.booking.PackageDetailResponse;
import com.sep490.bms.dto.booking.PackageListItem;
import com.sep490.bms.dto.booking.PackagePreviewResponse;
import com.sep490.bms.dto.booking.PackageRequest;
import com.sep490.bms.dto.booking.WalkInBookingItem;
import com.sep490.bms.dto.booking.WalkInBookingRequest;
import com.sep490.bms.dto.request.BookingRequest;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.exception.GlobalExceptionHandler;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.BookingQueryService;
import com.sep490.bms.service.booking.BookingService;
import com.sep490.bms.service.booking.PackageService;
import com.sep490.bms.service.booking.WalkInBookingService;

/**
 * API đặt sân lẻ, đơn đặt lẻ, gói nhiều buổi, đặt tại quầy và lịch sử booking (UC14–UC17):
 * đúng route, đúng mã HTTP, câu báo, kiểm tra dữ liệu trước khi gọi service, và quyền theo vai trò.
 * Không cần DB: service là mock, method security chạy thật.
 */
class BookingControllersTests {

    @Configuration(proxyBeanMethods = false)
    @EnableMethodSecurity
    static class Config {
        @Bean BookingService bookingService() { return mock(BookingService.class); }
        @Bean BookingQueryService bookingQueryService() { return mock(BookingQueryService.class); }
        @Bean WalkInBookingService walkInBookingService() { return mock(WalkInBookingService.class); }
        @Bean PackageService packageService() { return mock(PackageService.class); }
        @Bean BookingController bookingController(BookingService b, BookingQueryService q, WalkInBookingService w) {
            return new BookingController(b, q, w);
        }
        @Bean BookingOrderController bookingOrderController(PackageService p) { return new BookingOrderController(p); }
        @Bean BookingPackageController bookingPackageController(BookingQueryService q, PackageService p) {
            return new BookingPackageController(q, p);
        }
    }

    private static final String BOOKING = """
            {"courtId":5,"date":"2026-11-30","startMinute":600,"endMinute":660,"note":"Mang thêm cầu"}""";
    private static final String ORDER = """
            {"date":"2026-11-30","ranges":[{"courtId":5,"startMinute":600,"endMinute":660},
             {"courtId":6,"startMinute":720,"endMinute":750}]}""";
    private static final String PACKAGE = """
            {"packageType":"CUSTOM","courtId":5,"sessions":[{"date":"2026-11-30","courtId":5,"startMinute":600,"endMinute":660},
             {"date":"2026-12-01","courtId":5,"startMinute":600,"endMinute":660}]}""";
    private static final String WALK_IN = """
            {"courtId":5,"date":"2026-11-30","startMinute":600,"endMinute":690,
             "customerName":"Nguyễn Văn An","customerPhone":"0912345678"}""";

    private AnnotationConfigApplicationContext context;
    private BookingService bookings;
    private BookingQueryService queries;
    private WalkInBookingService walkIns;
    private PackageService packages;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(Config.class);
        bookings = context.getBean(BookingService.class);
        queries = context.getBean(BookingQueryService.class);
        walkIns = context.getBean(WalkInBookingService.class);
        packages = context.getBean(PackageService.class);
        mvc = MockMvcBuilders.standaloneSetup(context.getBean(BookingController.class),
                        context.getBean(BookingOrderController.class), context.getBean(BookingPackageController.class))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        context.close();
    }

    // ---- UC14 đặt sân lẻ ----

    @Test
    void playerPreviewsSummaryWithoutHolding() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(bookings.previewSummary(eq(player), any())).thenReturn(BookingSummaryResponse.builder()
                .courtId(5L).courtName("Sân 1").build());

        mvc.perform(json(post("/api/bookings/summary"), BOOKING))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.courtName").value("Sân 1"));

        ArgumentCaptor<BookingRequest> request = ArgumentCaptor.forClass(BookingRequest.class);
        verify(bookings).previewSummary(eq(player), request.capture());
        assertThat(request.getValue().courtId()).isEqualTo(5L);
        assertThat(request.getValue().date()).isEqualTo(LocalDate.of(2026, 11, 30));
        assertThat(request.getValue().note()).isEqualTo("Mang thêm cầu");
    }

    @Test
    void playerCreatesHoldingBookingWith201() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(bookings.createSingleBooking(eq(player), any())).thenReturn(BookingResponse.builder()
                .id(11L).bookingCode("BK261130-7KQ2MX").status(BookingStatus.HOLDING).build());

        mvc.perform(json(post("/api/bookings"), BOOKING))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.bookingCode").value("BK261130-7KQ2MX"))
                .andExpect(jsonPath("$.data.status").value("HOLDING"));
    }

    @Test
    void slotNotOnHalfHourGridIsRejectedBeforeService() throws Exception {
        login(Role.PLAYER);

        mvc.perform(json(post("/api/bookings"), """
                {"courtId":5,"date":"2026-11-30","startMinute":615,"endMinute":660}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errors.validSlot").value("Slot phải theo bước 30 phút và giờ kết thúc sau giờ bắt đầu"));
        mvc.perform(json(post("/api/bookings"), """
                {"date":"2026-11-30","startMinute":600,"endMinute":660}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.courtId").exists());
        mvc.perform(json(post("/api/bookings"), """
                {"courtId":5,"date":"2026-11-30","startMinute":600,"endMinute":660,"voucherCode":"A","voucherGrantId":3}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.voucherSelectionValid").value("Chỉ chọn voucherCode hoặc voucherGrantId"));
        verifyNoInteractions(bookings);
    }

    @Test
    void businessErrorKeepsStatusAndMessage() throws Exception {
        login(Role.PLAYER);
        when(bookings.createSingleBooking(any(), any())).thenThrow(new AppException(
                "Slot vừa có người giữ hoặc đặt. Vui lòng chọn slot khác. (MSG28)", HttpStatus.CONFLICT));

        mvc.perform(json(post("/api/bookings"), BOOKING))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Slot vừa có người giữ hoặc đặt. Vui lòng chọn slot khác. (MSG28)"));
    }

    @Test
    void onlyPlayerCanBookOnline() throws Exception {
        for (Role role : new Role[] { Role.STAFF, Role.OWNER, Role.ADMIN }) {
            login(role);
            mvc.perform(json(post("/api/bookings"), BOOKING)).andExpect(status().isForbidden());
            mvc.perform(json(post("/api/booking-orders"), ORDER)).andExpect(status().isForbidden());
            mvc.perform(json(post("/api/booking-packages"), PACKAGE)).andExpect(status().isForbidden());
            mvc.perform(get("/api/me/bookings")).andExpect(status().isForbidden());
        }
        verifyNoInteractions(bookings, packages, queries);
    }

    // ---- UC14 đơn đặt lẻ nhiều dải ----

    @Test
    void playerPreviewsAndCreatesDayOrder() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(packages.previewOrder(eq(player), any())).thenReturn(PackagePreviewResponse.builder()
                .locationName("Sân Linh Đàm").build());
        when(packages.createOrder(eq(player), any())).thenReturn(PackageDetailResponse.builder().id(21L).build());

        mvc.perform(json(post("/api/booking-orders/preview"), ORDER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.locationName").value("Sân Linh Đàm"));
        mvc.perform(json(post("/api/booking-orders"), ORDER))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Đã tạo đơn, giữ chỗ trong 10 phút."))
                .andExpect(jsonPath("$.data.id").value(21));

        ArgumentCaptor<BookingOrderRequest> request = ArgumentCaptor.forClass(BookingOrderRequest.class);
        verify(packages).createOrder(eq(player), request.capture());
        assertThat(request.getValue().ranges()).hasSize(2);
        assertThat(request.getValue().ranges().get(1).courtId()).isEqualTo(6L);
    }

    @Test
    void dayOrderWithoutRangesIsRejected() throws Exception {
        login(Role.PLAYER);

        mvc.perform(json(post("/api/booking-orders"), """
                {"date":"2026-11-30","ranges":[]}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.ranges").exists());
        verifyNoInteractions(packages);
    }

    // ---- UC15 gói nhiều buổi ----

    @Test
    void playerPreviewsCreatesAndReadsPackage() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(packages.preview(eq(player), any())).thenReturn(PackagePreviewResponse.builder().locationName("Sân A").build());
        when(packages.create(eq(player), any())).thenReturn(PackageDetailResponse.builder().id(7L).build());
        when(queries.getMyPackage(player, 7L)).thenReturn(PackageDetailResponse.builder().id(7L).build());

        mvc.perform(json(post("/api/booking-packages/preview"), PACKAGE)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.locationName").value("Sân A"));
        mvc.perform(json(post("/api/booking-packages"), PACKAGE)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(7));
        mvc.perform(get("/api/booking-packages/7")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(7));

        ArgumentCaptor<PackageRequest> request = ArgumentCaptor.forClass(PackageRequest.class);
        verify(packages).create(eq(player), request.capture());
        assertThat(request.getValue().sessions()).hasSize(2);
    }

    @Test
    void packageWithoutTypeIsRejected() throws Exception {
        login(Role.PLAYER);

        mvc.perform(json(post("/api/booking-packages/preview"), """
                {"courtId":5,"sessions":[]}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.packageType").exists());
        verifyNoInteractions(packages);
    }

    // ---- UC17 lịch sử booking ----

    @Test
    void historyUsesDefaultPagingAndOptionalStatus() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(queries.listMyBookings(any(), any(), anyInt(), anyInt())).thenReturn(page(
                BookingListItem.builder().id(11L).build()));
        when(queries.listMyPackages(any(), any(), anyInt(), anyInt())).thenReturn(page(
                PackageListItem.builder().id(7L).build()));

        mvc.perform(get("/api/me/bookings")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(11));
        mvc.perform(get("/api/me/bookings").param("status", "HOLDING").param("page", "2").param("size", "5"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/me/booking-packages").param("status", "CONFIRMED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(7));

        verify(queries).listMyBookings(player, null, 0, 20);
        verify(queries).listMyBookings(player, BookingStatus.HOLDING, 2, 5);
        verify(queries).listMyPackages(player, BookingStatus.CONFIRMED, 0, 20);
    }

    @Test
    void unknownStatusFilterIs400() throws Exception {
        login(Role.PLAYER);

        mvc.perform(get("/api/me/bookings").param("status", "PAID_LATER"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Giá trị của tham số status không hợp lệ"));
        verifyNoInteractions(queries);
    }

    @Test
    void playerReadsOwnBookingDetail() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(queries.getMyBooking(player, 11L)).thenReturn(BookingDetailResponse.builder()
                .id(11L).bookingCode("BK261130-7KQ2MX").build());

        mvc.perform(get("/api/bookings/11")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingCode").value("BK261130-7KQ2MX"));
    }

    // ---- UC16 đặt tại quầy ----

    @Test
    void staffCreatesWalkInHoldFor10Minutes() throws Exception {
        UserPrincipal staff = login(Role.STAFF);
        when(walkIns.create(eq(staff), any())).thenReturn(WalkInBookingItem.builder()
                .id(31L).bookingCode("BK261130-ABCDEF").status(BookingStatus.HOLDING)
                .finalAmount(new BigDecimal("180000")).build());

        mvc.perform(json(post("/api/staff/bookings"), WALK_IN))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Đã tạo booking, giữ chỗ trong 10 phút. Xác nhận khi đã nhận đủ tiền."))
                .andExpect(jsonPath("$.data.bookingCode").value("BK261130-ABCDEF"));

        ArgumentCaptor<WalkInBookingRequest> request = ArgumentCaptor.forClass(WalkInBookingRequest.class);
        verify(walkIns).create(eq(staff), request.capture());
        assertThat(request.getValue().endMinute()).as("nhiều slot liền nhau (D183)").isEqualTo(690);
        assertThat(request.getValue().customerPhone()).isEqualTo("0912345678");
    }

    @Test
    void walkInCustomerDataIsValidated() throws Exception {
        login(Role.STAFF);

        mvc.perform(json(post("/api/staff/bookings"), WALK_IN.replace("0912345678", "912345678")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.customerPhone")
                        .value("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0"));
        mvc.perform(json(post("/api/staff/bookings"), WALK_IN.replace("Nguyễn Văn An", "")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.customerName").exists());
        verifyNoInteractions(walkIns);
    }

    @Test
    void staffListsWalkInsWithFilters() throws Exception {
        UserPrincipal staff = login(Role.STAFF);
        when(walkIns.list(any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(page(WalkInBookingItem.builder().id(31L).build()));

        mvc.perform(get("/api/staff/bookings")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(31));
        mvc.perform(get("/api/staff/bookings").param("date", "2026-11-30").param("status", "HOLDING")
                .param("page", "1").param("size", "10")).andExpect(status().isOk());

        verify(walkIns).list(staff, null, null, 0, 20);
        verify(walkIns).list(staff, LocalDate.of(2026, 11, 30), BookingStatus.HOLDING, 1, 10);
    }

    @Test
    void staffConfirmMessageNamesTheBookingCode() throws Exception {
        UserPrincipal staff = login(Role.STAFF);
        when(walkIns.confirm(staff, 31L)).thenReturn(WalkInBookingItem.builder()
                .id(31L).bookingCode("BK261130-ABCDEF").status(BookingStatus.CONFIRMED).receiptNo("RC-31").build());

        mvc.perform(post("/api/staff/bookings/31/confirm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã xác nhận thanh toán booking BK261130-ABCDEF."))
                .andExpect(jsonPath("$.data.receiptNo").value("RC-31"));
    }

    @Test
    void onlyStaffUsesTheCounter() throws Exception {
        for (Role role : new Role[] { Role.PLAYER, Role.OWNER, Role.ADMIN }) {
            login(role);
            mvc.perform(json(post("/api/staff/bookings"), WALK_IN)).andExpect(status().isForbidden());
            mvc.perform(get("/api/staff/bookings")).andExpect(status().isForbidden());
            mvc.perform(post("/api/staff/bookings/31/confirm")).andExpect(status().isForbidden());
        }
        verifyNoInteractions(walkIns);
    }

    private UserPrincipal login(Role role) {
        UserPrincipal user = UserPrincipal.builder().id(7L).role(role).locationId(1L).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                user, null, AuthorityUtils.createAuthorityList("ROLE_" + role.name())));
        return user;
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @SafeVarargs
    private static <T> PageResponse<T> page(T... items) {
        return PageResponse.<T>builder().content(List.of(items)).pageNumber(0).pageSize(20)
                .totalElements(items.length).totalPages(1).build();
    }
}
