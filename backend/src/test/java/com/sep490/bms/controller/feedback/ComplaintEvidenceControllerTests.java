package com.sep490.bms.controller.feedback;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import com.sep490.bms.dto.feedback.*;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.feedback.ComplaintEvidenceService;

/** Kiểm tra multipart/validation và method security của API ảnh khiếu nại, không cần DB. */
class ComplaintEvidenceControllerTests {
    @Configuration(proxyBeanMethods=false) @EnableMethodSecurity
    static class Config {
        @Bean ComplaintEvidenceService service() { return mock(ComplaintEvidenceService.class); }
        @Bean ComplaintEvidenceController controller(ComplaintEvidenceService service) { return new ComplaintEvidenceController(service); }
    }
    AnnotationConfigApplicationContext context;
    ComplaintEvidenceService service;
    ComplaintEvidenceController controller;
    MockMvc mvc;
    @BeforeEach void setup() {
        context = new AnnotationConfigApplicationContext(Config.class);
        service = context.getBean(ComplaintEvidenceService.class); controller = context.getBean(ComplaintEvidenceController.class);
        mvc = MockMvcBuilders.standaloneSetup(controller).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); context.close(); }
    UserPrincipal authenticate(Role role) {
        var user = UserPrincipal.builder().id(7L).role(role).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, AuthorityUtils.createAuthorityList("ROLE_" + role.name())));
        return user;
    }
    MockMultipartFile data(String content) { return new MockMultipartFile("data", "data", "application/json", content.getBytes(StandardCharsets.UTF_8)); }
    @Test void playerMultipartCreatesComplaintWithoutChangingPayloadFields() throws Exception {
        var user = authenticate(Role.PLAYER);
        when(service.create(eq(user), any(), any())).thenReturn(ComplaintResponse.builder().id(42L).complaintType("COURT_SERVICE").status("SUBMITTED").build());
        mvc.perform(multipart("/api/complaints/with-evidence").file(data("{\"bookingId\":12,\"complaintType\":\"COURT_SERVICE\",\"content\":\"Sân cần hỗ trợ\"}"))
                .file(new MockMultipartFile("evidence", "court.png", "image/png", new byte[]{1,2})))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value(42)).andExpect(jsonPath("$.data.status").value("SUBMITTED"));
        var request = org.mockito.ArgumentCaptor.forClass(CreateComplaintRequest.class);
        verify(service).create(eq(user), request.capture(), any());
        assertThat(request.getValue().getBookingId()).isEqualTo(12L);
        assertThat(request.getValue().getPaymentId()).isNull();
        assertThat(request.getValue().getContent()).isEqualTo("Sân cần hỗ trợ");
    }
    @Test void missingImageOrInvalidRequestReturns400BeforeService() throws Exception {
        authenticate(Role.PLAYER);
        mvc.perform(multipart("/api/complaints/with-evidence").file(data("{\"complaintType\":\"OTHER\",\"content\":\"Vấn đề\"}"))).andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/complaints/with-evidence").file(data("{\"complaintType\":\"OTHER\",\"content\":\"\"}"))
                .file(new MockMultipartFile("evidence", "court.png", "image/png", new byte[]{1}))).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void nonPlayerCannotCreateAndGuestCannotRead() {
        for (Role role : new Role[]{Role.OWNER, Role.STAFF, Role.ADMIN}) {
            var user = authenticate(role);
            assertThatThrownBy(() -> controller.create(user, new CreateComplaintRequest(), null)).isInstanceOf(AccessDeniedException.class);
        }
        SecurityContextHolder.clearContext();
        assertThatThrownBy(() -> controller.metadata(null, 42L)).isInstanceOf(AuthenticationCredentialsNotFoundException.class);
        verifyNoInteractions(service);
    }
    @Test void metadataHasNoStoragePathAndImageIsPrivateNoStore() throws Exception {
        var user = authenticate(Role.PLAYER);
        when(service.metadata(user, 42L)).thenReturn(new ComplaintEvidenceResponse(42L, "image/png", 2L, null));
        when(service.image(user, 42L)).thenReturn(new ByteArrayResource(new byte[]{1,2}) { @Override public String getFilename() { return "fixture.png"; } });
        mvc.perform(get("/api/complaints/42/evidence")).andExpect(status().isOk()).andExpect(jsonPath("$.data.complaintId").value(42))
                .andExpect(jsonPath("$.data.imagePath").doesNotExist());
        mvc.perform(get("/api/complaints/42/evidence/image")).andExpect(status().isOk()).andExpect(content().contentType("image/png"))
                .andExpect(header().string("Cache-Control", "no-store")).andExpect(header().string("X-Content-Type-Options", "nosniff"));
    }
}
