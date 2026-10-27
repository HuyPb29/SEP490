package com.sep490.bms.entity.promotion;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "player_location_balance")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlayerLocationBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "player_id", nullable = false)
    private Long playerId;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "point_balance", nullable = false)
    private int pointBalance;

    @Column(name = "total_paid", nullable = false, precision = 14, scale = 0)
    @Builder.Default
    private BigDecimal totalPaid = BigDecimal.ZERO;

    @Version
    @Column(nullable = false)
    private int version;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
