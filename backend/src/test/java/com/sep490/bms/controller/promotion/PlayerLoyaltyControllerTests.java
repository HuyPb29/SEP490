package com.sep490.bms.controller.promotion;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.sep490.bms.dto.promotion.PlayerLoyaltyProgressResponse;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.promotion.PlayerLoyaltyProgressService;

/** Kiểm tra HTTP binding và method security thật của API Player mới, không cần DB. */
class PlayerLoyaltyControllerTests {
    @Configuration(proxyBeanMethods=false)
    @EnableMethodSecurity
    static class Config {
        @Bean PlayerLoyaltyProgressService service() { return mock(PlayerLoyaltyProgressService.class); }
        @Bean PlayerLoyaltyController controller(PlayerLoyaltyProgressService service) { return new PlayerLoyaltyController(service); }
    }
    private AnnotationConfigApplicationContext context;
    private PlayerLoyaltyProgressService service;
    private PlayerLoyaltyController controller;
    @BeforeEach void setup() {
        context = new AnnotationConfigApplicationContext(Config.class);
        service = context.getBean(PlayerLoyaltyProgressService.class);
        controller = context.getBean(PlayerLoyaltyController.class);
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); context.close(); }
    private UserPrincipal authenticate(Role role) {
        var user = UserPrincipal.builder().id(7L).role(role).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null,
                AuthorityUtils.createAuthorityList("ROLE_" + role.name())));
        return user;
    }
    @Test void authenticatedPlayerGetsOnlyOwnProgressWithRequiredLocationQuery() throws Exception {
        var user = authenticate(Role.PLAYER);
        when(service.progress(user, 12L)).thenReturn(new PlayerLoyaltyProgressResponse(12L,
                new BigDecimal("800000"), new BigDecimal("1000000"), new BigDecimal("200000"), "Đồng hành", new BigDecimal("50000")));
        var mvc = MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
        mvc.perform(get("/api/me/loyalty-milestones").param("locationId", "12"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.locationId").value(12))
                .andExpect(jsonPath("$.data.remainingAmount").value(200000))
                .andExpect(jsonPath("$.data.rewardValue").value(50000));
        verify(service).progress(user, 12L);
        mvc.perform(get("/api/me/loyalty-milestones")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/loyalty-milestones").param("locationId", "abc")).andExpect(status().isBadRequest());
        verifyNoMoreInteractions(service);
    }
    @Test void ownerStaffAdminCannotInvokePlayerController() {
        for (Role role : new Role[]{Role.OWNER, Role.STAFF, Role.ADMIN}) {
            var user = authenticate(role);
            assertThatThrownBy(() -> controller.progress(user, 12L)).isInstanceOf(AccessDeniedException.class);
        }
        verifyNoInteractions(service);
    }
    @Test void unauthenticatedRequestCannotInvokePlayerController() {
        assertThatThrownBy(() -> controller.progress(null, 12L)).isInstanceOf(AuthenticationCredentialsNotFoundException.class);
        verifyNoInteractions(service);
    }
}
