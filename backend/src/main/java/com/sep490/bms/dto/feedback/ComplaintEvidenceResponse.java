package com.sep490.bms.dto.feedback;
import java.time.LocalDateTime;
import com.sep490.bms.entity.feedback.ComplaintEvidence;

/** Metadata ảnh dành cho người được xem khiếu nại; không trả đường dẫn lưu trên server. */
public record ComplaintEvidenceResponse(Long complaintId, String contentType, long sizeBytes, LocalDateTime createdAt) {
    public static ComplaintEvidenceResponse from(ComplaintEvidence image) {
        return new ComplaintEvidenceResponse(image.getComplaintId(), image.getContentType(), image.getSizeBytes(), image.getCreatedAt());
    }
}
