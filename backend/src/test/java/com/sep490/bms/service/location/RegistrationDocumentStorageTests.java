package com.sep490.bms.service.location;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import com.sep490.bms.service.integration.FileStorageService;

class RegistrationDocumentStorageTests {
    @TempDir Path root;

    @Test void storesJpgPngAndPdfUsingGeneratedPrivatePaths() throws Exception {
        var storage = new FileStorageService(root.toString());
        var files = new MockMultipartFile[] {
            new MockMultipartFile("identityDocument", "cccd.jpg", "image/jpeg", new byte[] {(byte)255,(byte)216,(byte)255,0}),
            new MockMultipartFile("identityDocument", "cccd.png", "image/png", new byte[] {(byte)137,80,78,71,13,10,26,10}),
            new MockMultipartFile("businessLicense", "license.pdf", "application/pdf", "%PDF-1.4\n%%EOF".getBytes(java.nio.charset.StandardCharsets.US_ASCII))
        };
        for (var file : files) {
            String path = storage.storeRegistrationDocument(file, "verification", "giấy tờ");
            assertThat(path).startsWith("verification/").doesNotContain(file.getOriginalFilename());
            try (var input = storage.load(path).getInputStream()) {
                assertThat(input.readAllBytes()).isEqualTo(file.getBytes());
            }
            storage.discardImage(path);
            assertThat(Files.exists(root.resolve(path))).isFalse();
        }
    }

    @Test void rejectsMissingOversizedUnsupportedAndForgedDocuments() throws Exception {
        var storage = new FileStorageService(root.toString());
        assertThatThrownBy(() -> storage.validateRegistrationDocument(null, "CCCD")).hasMessageContaining("CCCD");
        assertThatThrownBy(() -> storage.validateRegistrationDocument(new MockMultipartFile("f", new byte[0]), "CCCD")).hasMessageContaining("CCCD");
        assertThatThrownBy(() -> storage.validateRegistrationDocument(new MockMultipartFile("f", "large.pdf", "application/pdf", new byte[5*1024*1024+1]), "CCCD")).hasMessageContaining("5 MB");
        assertThatThrownBy(() -> storage.storeRegistrationDocument(new MockMultipartFile("f", "fake.pdf", "application/pdf", "<script>alert(1)</script>".getBytes()), "verification", "CCCD")).hasMessageContaining("không đúng nội dung");
        assertThatThrownBy(() -> storage.storeRegistrationDocument(new MockMultipartFile("f", "x.html", "text/html", "html".getBytes()), "verification", "CCCD")).hasMessageContaining("chỉ nhận");
        try (var files = Files.list(root)) { assertThat(files.count()).isZero(); }
    }

    @Test void paymentProofStillRejectsPdfAndLoadCannotEscapeStorageRoot() {
        var storage = new FileStorageService(root.toString());
        var pdf = new MockMultipartFile("proof", "proof.pdf", "application/pdf", "%PDF-1.4".getBytes());
        assertThatThrownBy(() -> storage.storeImage(pdf, "proofs")).hasMessageContaining("Chỉ nhận ảnh JPG hoặc PNG");
        assertThatThrownBy(() -> storage.load("../../outside.pdf")).hasMessageContaining("Đường dẫn ảnh không hợp lệ");
    }
}
