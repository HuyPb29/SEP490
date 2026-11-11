package com.sep490.bms.entity.account;

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
 * Lưu hồ sơ, thông tin xác thực, vai trò và trạng thái truy cập của tài khoản.
 */
@Entity
@Table(name = "account")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 32, updatable = false)
    private String username;

    @Column(length = 100)
    private String email;

    @Column(length = 10)
    private String phone;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 50)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Role role;

    @Column(name = "skill_level", length = 30)
    private String skillLevel;

    @Column(name = "location_id")
    private Long locationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private AccountStatus status;

    @Column(name = "token_version", nullable = false)
    private long tokenVersion;

    @Column(name="failed_login_count",nullable=false)
    private int failedLoginCount;

    /** Null distinguishes an Admin lock from a temporary failed-login lock. */
    @Column(name="locked_until")
    private LocalDateTime lockedUntil;

    @Column(name="last_login_at")
    private LocalDateTime lastLoginAt;

    /** Caller must hold the account row lock. Invalidates every previously issued token. */
    public void revokeTokens() {
        this.tokenVersion = Math.incrementExact(this.tokenVersion);
    }

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = AccountStatus.ACTIVE;
        }
    }
}
