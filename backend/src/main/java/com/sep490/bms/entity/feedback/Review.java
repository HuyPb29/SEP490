package com.sep490.bms.entity.feedback;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

@Entity
@Table(name = "review")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id", nullable = false, unique = true)
    private Long bookingId;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "player_id", nullable = false)
    private Long playerId;

    @Column(nullable = false)
    private short rating;

    @Column(length = 1000)
    private String comment;

    @Column(name = "owner_reply", length = 1000)
    private String ownerReply;

    @Column(name = "is_hidden", nullable = false)
    private boolean hidden;

    @Column(name = "hidden_by")
    private Long hiddenBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
