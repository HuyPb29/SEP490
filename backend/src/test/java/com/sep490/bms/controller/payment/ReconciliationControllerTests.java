package com.sep490.bms.controller.payment;

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
import com.sep490.bms.dto.payment.ReconciliationRequest;
import com.sep490.bms.dto.payment.ReconciliationResponse;
import com.sep490.bms.dto.payment.ReconciliationSummaryResponse;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.exception.GlobalExceptionHandler;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.payment.ReconciliationService;

/**
 * API đối soát cuối ngày (UC20, D29): Staff xem tổng và lưu một lần mỗi ngày, Owner xem kết quả.
 */
class ReconciliationControllerTests {

    @Configuration(proxyBeanMethods = false)
    @EnableMethodSecurity
    static class Config {
        @Bean ReconciliationService reconciliationService() { return mock(ReconciliationService.class); }
        @Bean ReconciliationController reconciliationController(ReconciliationService service) {
            return new ReconciliationController(service);
        }
    }

    private static final LocalDate DAY = LocalDate.of(2026, 11, 25);

    private AnnotationConfigApplicationContext context;
    private ReconciliationService reconciliations;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(Config.class);
        reconciliations = context.getBean(ReconciliationService.class);
        mvc = MockMvcBuilders.standaloneSetup(context.getBean(ReconciliationController.class))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        context.close();
    }

    @Test
    void staffReadsDaySummaryTodayByDefault() throws Exception {
        UserPrincipal staff = login(Role.STAFF);
        when(reconciliations.getDaySummary(any(), any())).thenReturn(ReconciliationSummaryResponse.builder()
                .date(DAY).confirmedCount(3).systemAmount(new BigDecimal("540000")).build());

        mvc.perform(get("/api/staff/reconciliations")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.confirmedCount").value(3));
        mvc.perform(get("/api/staff/reconciliations").param("date", "2026-11-25")).andExpect(status().isOk());

        verify(reconciliations).getDaySummary(staff, null);
        verify(reconciliations).getDaySummary(staff, DAY);
    }

    @Test
    void staffSavesResultAndMessageShowsVietnameseDate() throws Exception {
        UserPrincipal staff = login(Role.STAFF);
        when(reconciliations.submit(eq(staff), any())).thenReturn(ReconciliationResponse.builder()
                .id(9L).date(DAY).actualAmount(new BigDecimal("500000")).difference(new BigDecimal("-40000")).build());

        mvc.perform(json(post("/api/staff/reconciliations"),
                        "{\"date\":\"2026-11-25\",\"actualAmount\":500000,\"reason\":\"Khách chuyển nhầm sang ngày mai\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Đã lưu kết quả đối soát ngày 25/11/2026."))
                .andExpect(jsonPath("$.data.id").value(9));

        ArgumentCaptor<ReconciliationRequest> request = ArgumentCaptor.forClass(ReconciliationRequest.class);
        verify(reconciliations).submit(eq(staff), request.capture());
        assertThat(request.getValue().actualAmount()).isEqualByComparingTo("500000");
        assertThat(request.getValue().reason()).isEqualTo("Khách chuyển nhầm sang ngày mai");
    }

    @Test
    void amountAndDateAreValidatedBeforeSaving() throws Exception {
        login(Role.STAFF);

        mvc.perform(json(post("/api/staff/reconciliations"), "{\"actualAmount\":500000}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.date").value("Vui lòng chọn ngày đối soát"));
        mvc.perform(json(post("/api/staff/reconciliations"), "{\"date\":\"2026-11-25\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.actualAmount").value("Vui lòng nhập số tiền thực nhận"));
        mvc.perform(json(post("/api/staff/reconciliations"), "{\"date\":\"2026-11-25\",\"actualAmount\":-1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.actualAmount").value("Số tiền thực nhận không được âm"));
        mvc.perform(json(post("/api/staff/reconciliations"), "{\"date\":\"2026-11-25\",\"actualAmount\":1000000000000}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(reconciliations);
    }

    @Test
    void savingTheSameDayTwiceKeepsConflictMessage() throws Exception {
        login(Role.STAFF);
        when(reconciliations.submit(any(), any())).thenThrow(new AppException(
                "Ngày 25/11/2026 đã được đối soát.", HttpStatus.CONFLICT));

        mvc.perform(json(post("/api/staff/reconciliations"), "{\"date\":\"2026-11-25\",\"actualAmount\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Ngày 25/11/2026 đã được đối soát."));
    }

    @Test
    void staffAndOwnerReadASavedResult() throws Exception {
        when(reconciliations.getById(any(), eq(9L))).thenReturn(ReconciliationResponse.builder().id(9L).date(DAY).build());

        for (Role role : new Role[] { Role.STAFF, Role.OWNER }) {
            login(role);
            mvc.perform(get("/api/staff/reconciliations/9")).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.id").value(9));
        }
    }

    @Test
    void ownerListsResultsWithRangeAndPaging() throws Exception {
        UserPrincipal owner = login(Role.OWNER);
        when(reconciliations.listForOwner(any(), any(), any(), anyInt(), anyInt())).thenReturn(
                PageResponse.<ReconciliationResponse>builder()
                        .content(List.of(ReconciliationResponse.builder().id(9L).date(DAY).build())).totalPages(1).build());

        mvc.perform(get("/api/owner/reconciliations")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(9));
        mvc.perform(get("/api/owner/reconciliations").param("from", "2026-11-01").param("to", "2026-11-25")
                .param("page", "2").param("size", "10")).andExpect(status().isOk());

        verify(reconciliations).listForOwner(owner, null, null, 0, 20);
        verify(reconciliations).listForOwner(owner, LocalDate.of(2026, 11, 1), DAY, 2, 10);
    }

    @Test
    void rolesAreKeptApart() throws Exception {
        login(Role.OWNER);
        mvc.perform(get("/api/staff/reconciliations")).andExpect(status().isForbidden());
        mvc.perform(json(post("/api/staff/reconciliations"), "{\"date\":\"2026-11-25\",\"actualAmount\":0}"))
                .andExpect(status().isForbidden());

        login(Role.STAFF);
        mvc.perform(get("/api/owner/reconciliations")).andExpect(status().isForbidden());

        login(Role.PLAYER);
        mvc.perform(get("/api/staff/reconciliations/9")).andExpect(status().isForbidden());
        verifyNoInteractions(reconciliations);
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
}
