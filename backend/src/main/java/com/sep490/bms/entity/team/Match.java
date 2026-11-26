package com.sep490.bms.entity.team;

import java.time.LocalDateTime;

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
 * Lưu kèo mở từ booking, số người hiện có, số chỗ cần tuyển và trạng thái.
 */
@Entity
@jakarta.persistence.EntityListeners(com.sep490.bms.service.notification.RealtimeEntityListener.class)
// "match" là từ khóa của SQL Server nên phải quote tên bảng.
@Table(name = "`match`")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Column(name = "current_players", nullable = false)
    private int currentPlayers;

    @Column(name = "needed_players", nullable = false)
    private int neededPlayers;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private MatchStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "reschedule_pending", nullable = false)
    private boolean reschedulePending;

    /** Trình độ chủ kèo chọn khi mở kèo (DR33); null = Không yêu cầu. Chỉ là nhãn, không chặn người xin vào. */
    @Column(name = "skill_level", length = 30)
    private String skillLevel;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = MatchStatus.OPEN;
        }
    }
}
