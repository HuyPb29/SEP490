package com.sep490.bms.controller.location;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.AdminLocationService;
import com.sep490.bms.service.location.LocationManagementService;

class LocationQrUploadControllerTests {

    @ParameterizedTest
    @ValueSource(strings = { "jpg", "png" })
    void uploadedQrPathIsReturnedInDataForTheFrontendPreview(String extension) {
        var locations = mock(LocationManagementService.class);
        var controller = new LocationManagementController(locations, mock(AdminLocationService.class));
        var owner = UserPrincipal.builder().id(7L).role(Role.OWNER).build();
        var image = new MockMultipartFile("image", "qr." + extension,
                "jpg".equals(extension) ? "image/jpeg" : "image/png", new byte[] { 1, 2, 3 });
        String storedPath = "location-qr/2026/11/saved-qr." + extension;
        when(locations.uploadQr(owner, 3L, image)).thenReturn(storedPath);

        var response = controller.uploadQr(owner, 3L, image);
        var json = new ObjectMapper().registerModule(new JavaTimeModule()).valueToTree(response);

        assertThat(json.path("success").asBoolean()).isTrue();
        assertThat(json.path("data").asText()).isEqualTo(storedPath);
        assertThat(json.path("message").asText()).isEqualTo("Đã lưu ảnh QR");
        verify(locations).uploadQr(owner, 3L, image);
    }
}
