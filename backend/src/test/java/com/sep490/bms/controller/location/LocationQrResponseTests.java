package com.sep490.bms.controller.location;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Base64;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.sep490.bms.entity.account.Role;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.AdminLocationService;
import com.sep490.bms.service.location.LocationManagementService;

/** HTTP response contract only; ownership/role checks remain in the real service. */
class LocationQrResponseTests {
    private final LocationManagementService service = mock(LocationManagementService.class);
    private final UserPrincipal owner = UserPrincipal.builder().id(7L).role(Role.OWNER).build();
    private final byte[] png = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX6sAAAAASUVORK5CYII=");
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(owner, null));
        mvc = MockMvcBuilders.standaloneSetup(new LocationManagementController(service, mock(AdminLocationService.class)))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
    }

    @AfterEach
    void clearSession() { SecurityContextHolder.clearContext(); }

    @Test
    void uploadReturnsPathInDataAndHumanMessageSeparately() throws Exception {
        String path = "location-qr/2026/11/owner-qr.png";
        when(service.uploadQr(eq(owner), eq(1L), any())).thenReturn(path);
        mvc.perform(multipart("/api/owner/locations/1/qr")
                .file(new MockMultipartFile("image", "qr.png", "image/png", png)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").value(path)).andExpect(jsonPath("$.message").value("Đã lưu ảnh QR"));
        verify(service).uploadQr(eq(owner), eq(1L), any());
    }

    @Test
    void previewReturnsActualImageWithContentType() throws Exception {
        when(service.loadQr(owner, 1L)).thenReturn(new ByteArrayResource(png) {
            @Override public String getFilename() { return "qr.png"; }
        });
        mvc.perform(get("/api/owner/locations/1/qr"))
                .andExpect(status().isOk()).andExpect(content().contentType("image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(content().bytes(png));
    }

    @Test
    void uploadRequiresImagePart() throws Exception {
        mvc.perform(multipart("/api/owner/locations/1/qr")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
