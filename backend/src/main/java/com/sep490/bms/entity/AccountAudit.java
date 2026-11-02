package com.sep490.bms.entity;

import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.*;

/** Append-only application history. No credential, request body or token is stored. */
@Entity
@Table(name = "account_audit")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class AccountAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "actor_id", nullable = false, updatable = false)
    private Long actorId;
    @Enumerated(EnumType.STRING)
    @Column(name = "actor_role", nullable = false, updatable = false, length = 10)
    private Role actorRole;
    @Column(name = "target_account_id", nullable = false, updatable = false)
    private Long targetAccountId;
    @Column(name = "location_id", updatable = false)
    private Long locationId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 40)
    private AccountAuditAction action;
    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", updatable = false, length = 10)
    private AccountStatus previousStatus;
    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", updatable = false, length = 10)
    private AccountStatus newStatus;
    @Column(updatable = false, length = 500)
    private String reason;
    @Column(nullable = false, updatable = false, length = 10)
    private String outcome;
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void initialize() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
