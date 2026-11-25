package com.sep490.bms.entity.feedback;

import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.*;

/** Ảnh minh chứng tùy chọn của khiếu nại; mỗi khiếu nại lưu một ảnh riêng tư. */
@Entity @Table(name="complaint_evidence")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ComplaintEvidence {
    @Id @Column(name="complaint_id")
    private Long complaintId;
    @Column(name="image_path", nullable=false, length=500)
    private String imagePath;
    @Column(name="content_type", nullable=false, length=30)
    private String contentType;
    @Column(name="size_bytes", nullable=false)
    private long sizeBytes;
    @Column(name="created_at", nullable=false)
    private LocalDateTime createdAt;
}
