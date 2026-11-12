package com.sep490.bms.entity.location;

import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.ApprovalStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Lưu thời gian bảo trì sân, người gửi yêu cầu và quyết định xử lý.
 */
@Entity
@Table(name = "maintenance")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Maintenance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "court_id", nullable = false)
    private Long courtId;

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private LocalDateTime endAt;

    @Column(nullable = false, length = 500)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private ApprovalStatus status = ApprovalStatus.PENDING;

    @Column(name = "requested_by", nullable = false)
    private Long requestedBy;

    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    /**
     * Người tạo đã rút yêu cầu (chỉ khi status = CANCELLED). Tách khỏi approved_by để
     * giữ vết riêng: approved_by là người duyệt/từ chối, cancelled_by là người huỷ.
     * Không đặt khóa ngoại để giữ nguyên số khóa ngoại mà script kiểm tra của nhóm công bố;
     * giá trị này luôn lấy từ tài khoản đang đăng nhập nên không nhận từ client.
     */
    @Column(name = "cancelled_by")
    private Long cancelledBy;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
