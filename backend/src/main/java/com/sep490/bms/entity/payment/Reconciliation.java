package com.sep490.bms.entity.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
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
@Table(name = "reconciliation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Reconciliation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "recon_date", nullable = false)
    private LocalDate reconDate;

    @Column(name = "system_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal systemAmount;

    @Column(name = "actual_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal actualAmount;

    // Cột tính sẵn trong DB: actual_amount - system_amount
    @Column(precision = 12, scale = 0, insertable = false, updatable = false)
    private BigDecimal difference;

    @Column(length = 500)
    private String reason;

    @Column(name = "staff_id", nullable = false)
    private Long staffId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
