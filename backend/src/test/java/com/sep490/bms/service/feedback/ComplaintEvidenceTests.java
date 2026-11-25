package com.sep490.bms.service.feedback;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.*;
import com.sep490.bms.dto.feedback.*;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.feedback.ComplaintEvidence;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.feedback.ComplaintEvidenceRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.integration.FileStorageService;

/** Kiểm tra upload thật vào thư mục tạm, rollback dọn file, giới hạn ảnh và cổng phân quyền sẵn có. */
class ComplaintEvidenceTests {
    @TempDir Path root;
    final ComplaintService complaints = mock(ComplaintService.class);
    final ComplaintEvidenceRepository evidence = mock(ComplaintEvidenceRepository.class);
    final UserPrincipal player = UserPrincipal.builder().id(7L).role(Role.PLAYER).build();
    final CreateComplaintRequest request = CreateComplaintRequest.builder().bookingId(12L).complaintType("COURT_SERVICE").content("Sân có vấn đề").build();
    ComplaintEvidenceService service;
    FileStorageService storage;
    TestTransactions manager;
    TransactionTemplate tx;

    /** Transaction lifecycle thật của Spring, không mở kết nối tới DB. */
    static class TestTransactions extends AbstractPlatformTransactionManager {
        boolean rolledBack;
        protected Object doGetTransaction() { return new Object(); }
        protected void doBegin(Object transaction, TransactionDefinition definition) {}
        protected void doCommit(DefaultTransactionStatus status) {}
        protected void doRollback(DefaultTransactionStatus status) { rolledBack = true; }
    }
    @BeforeEach void setup() {
        storage = new FileStorageService(root.toString());
        service = new ComplaintEvidenceService(complaints, evidence, storage);
        manager = new TestTransactions(); tx = new TransactionTemplate(manager);
        when(complaints.createComplaint(player, request)).thenReturn(ComplaintResponse.builder().id(42L).complaintType("COURT_SERVICE").status("SUBMITTED").build());
    }
    MockMultipartFile image(String type, int size) { return new MockMultipartFile("evidence", "evidence.png", type, new byte[size]); }
    List<Path> files() throws Exception { try (var files = Files.walk(root)) { return files.filter(Files::isRegularFile).toList(); } }

    @Test void createsOneComplaintAndPrivateImageInSameTransaction() throws Exception {
        var result = tx.execute(status -> service.create(player, request, image("image/png", 12)));
        assertThat(result.getId()).isEqualTo(42L);
        verify(complaints).createComplaint(player, request);
        var saved = org.mockito.ArgumentCaptor.forClass(ComplaintEvidence.class);
        verify(evidence).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getComplaintId()).isEqualTo(42L);
        assertThat(saved.getValue().getContentType()).isEqualTo("image/png");
        assertThat(saved.getValue().getSizeBytes()).isEqualTo(12);
        assertThat(saved.getValue().getImagePath()).startsWith("complaint-evidence/").endsWith(".png");
        assertThat(files()).hasSize(1);
    }
    @Test void acceptsJpegAtExistingFiveMbBoundary() throws Exception {
        tx.execute(status -> service.create(player, request, image("image/jpeg", 5 * 1024 * 1024)));
        assertThat(files()).hasSize(1); assertThat(files().get(0).toString()).endsWith(".jpg");
    }
    @Test void businessFailureRollsBackAndDiscardsImageWithoutCreatingEvidenceRow() throws Exception {
        when(complaints.createComplaint(player, request)).thenThrow(new AppException("Đã quá thời hạn gửi khiếu nại"));
        assertThatThrownBy(() -> tx.execute(status -> service.create(player, request, image("image/png", 12)))).hasMessageContaining("quá thời hạn");
        assertThat(manager.rolledBack).isTrue(); assertThat(files()).isEmpty(); verifyNoInteractions(evidence);
    }
    @Test void evidenceWriteFailureAlsoDiscardsStoredImage() throws Exception {
        doThrow(new IllegalStateException("Database failure")).when(evidence).saveAndFlush(any());
        assertThatThrownBy(() -> tx.execute(status -> service.create(player, request, image("image/png", 12)))).isInstanceOf(IllegalStateException.class);
        assertThat(manager.rolledBack).isTrue(); assertThat(files()).isEmpty();
    }
    @Test void emptyUnsupportedAndTooLargeFilesDoNotCreateComplaint() throws Exception {
        for (var bad : List.of(image("image/png", 0), image("image/svg+xml", 10), image("image/png", 5 * 1024 * 1024 + 1))) {
            assertThatThrownBy(() -> tx.execute(status -> service.create(player, request, bad))).isInstanceOf(AppException.class);
        }
        verifyNoInteractions(complaints, evidence); assertThat(files()).isEmpty();
    }
    @Test void otherRolesAndNullUserCannotUpload() throws Exception {
        assertThatThrownBy(() -> tx.execute(status -> service.create(null, request, image("image/png", 12)))).isInstanceOf(AppException.class);
        for (Role role : List.of(Role.OWNER, Role.STAFF, Role.ADMIN))
            assertThatThrownBy(() -> tx.execute(status -> service.create(UserPrincipal.builder().id(7L).role(role).build(), request, image("image/png", 12))))
                    .isInstanceOf(AppException.class).extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
        verifyNoInteractions(complaints, evidence); assertThat(files()).isEmpty();
    }
    @Test void metadataAndImageMustPassExistingComplaintReadPermissionFirst() {
        doThrow(new AppException("Không có quyền", HttpStatus.FORBIDDEN)).when(complaints).getComplaint(player, 42L);
        assertThatThrownBy(() -> service.metadata(player, 42L)).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.image(player, 42L)).isInstanceOf(AppException.class);
        verifyNoInteractions(evidence);
    }
    @Test void metadataDoesNotExposeStoragePathAndImageLoadsAuthorizedFile() throws Exception {
        String path = storage.storeImage(image("image/png", 12), "complaint-evidence");
        when(evidence.findById(42L)).thenReturn(Optional.of(ComplaintEvidence.builder().complaintId(42L).imagePath(path).contentType("image/png").sizeBytes(12).build()));
        var result = service.metadata(player, 42L);
        assertThat(result.complaintId()).isEqualTo(42L); assertThat(result.sizeBytes()).isEqualTo(12);
        assertThat(service.image(player, 42L).getContentAsByteArray()).hasSize(12);
        verify(complaints, times(2)).getComplaint(player, 42L);
    }
    @Test void optionalImageMetadataIsNullAndMissingImageReturns404() {
        when(evidence.findById(42L)).thenReturn(Optional.empty());
        assertThat(service.metadata(player, 42L)).isNull();
        assertThatThrownBy(() -> service.image(player, 42L)).isInstanceOf(AppException.class).extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }
    @Test void discardRefusesPathsOutsideUploadRoot() {
        assertThatThrownBy(() -> storage.discardImage("../outside.png")).isInstanceOf(AppException.class).hasMessageContaining("Đường dẫn");
    }
}
