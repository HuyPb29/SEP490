package com.sep490.bms.service.feedback;

import java.time.LocalDateTime;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import com.sep490.bms.dto.feedback.*;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.feedback.ComplaintEvidence;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.feedback.ComplaintEvidenceRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.integration.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Gửi khiếu nại kèm ảnh trong cùng giao dịch; quyền đọc ảnh kế thừa quyền đọc khiếu nại. */
@Service @RequiredArgsConstructor @Slf4j
public class ComplaintEvidenceService {
    private final ComplaintService complaints;
    private final ComplaintEvidenceRepository evidence;
    private final FileStorageService storage;

    @Transactional
    public ComplaintResponse create(UserPrincipal user, CreateComplaintRequest request, MultipartFile image) {
        if (user == null || user.getRole() != Role.PLAYER)
            throw new AppException("Chỉ người chơi được gửi khiếu nại kèm ảnh", HttpStatus.FORBIDDEN);
        String path = storage.storeImage(image, "complaint-evidence");
        // DB rollback must not leave an unreferenced private image on disk.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    try { storage.discardImage(path); }
                    catch (RuntimeException ex) { log.warn("Không thể dọn ảnh khiếu nại sau rollback"); }
                }
            }
        });
        ComplaintResponse complaint = complaints.createComplaint(user, request);
        evidence.saveAndFlush(ComplaintEvidence.builder().complaintId(complaint.getId()).imagePath(path)
                .contentType(image.getContentType()).sizeBytes(image.getSize()).createdAt(LocalDateTime.now()).build());
        return complaint;
    }

    @Transactional(readOnly=true)
    public ComplaintEvidenceResponse metadata(UserPrincipal user, Long id) {
        complaints.getComplaint(user, id);
        return evidence.findById(id).map(ComplaintEvidenceResponse::from).orElse(null);
    }

    @Transactional(readOnly=true)
    public Resource image(UserPrincipal user, Long id) {
        complaints.getComplaint(user, id);
        var image = evidence.findById(id)
                .orElseThrow(() -> new AppException("Khiếu nại chưa có ảnh đính kèm", HttpStatus.NOT_FOUND));
        return storage.load(image.getImagePath());
    }
}
