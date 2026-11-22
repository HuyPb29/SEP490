package com.sep490.bms.entity.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.*;
import com.sep490.bms.entity.enums.ApprovalStatus;

@Entity @Table(name="service_renewal_request")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ServiceRenewal {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="location_id", nullable=false) private Long locationId;
    @Column(name="owner_id", nullable=false) private Long ownerId;
    @Column(name="rental_years", nullable=false) private int rentalYears;
    @Column(name="court_count", nullable=false) private int courtCount;
    @Column(name="previous_end") private LocalDate previousEnd;
    @Column(name="quoted_start", nullable=false) private LocalDate quotedStart;
    @Column(name="quoted_end", nullable=false) private LocalDate quotedEnd;
    @Column(nullable=false, precision=12, scale=0) private BigDecimal amount;
    @Column(name="proof_path", nullable=false, length=255) private String proofPath;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=10) private ApprovalStatus status;
    @Column(name="reject_reason", length=500) private String rejectReason;
    @Column(name="service_term_id") private Long serviceTermId;
    @Column(name="created_at", nullable=false) private LocalDateTime createdAt;
    @Column(name="processed_at") private LocalDateTime processedAt;
    @Column(name="processed_by") private Long processedBy;
}
