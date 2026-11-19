package com.sep490.bms.entity.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import com.sep490.bms.entity.enums.ApprovalStatus;
import jakarta.persistence.*;
import lombok.*;

/** Yêu cầu mua thêm sân; giữ nguyên đơn giá và hạn hợp đồng tại lúc gửi. */
@Entity
@Table(name = "court_expansion_request")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CourtExpansion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name="location_id", nullable=false) private Long locationId;
    @Column(name="owner_id", nullable=false) private Long ownerId;
    @Column(name="court_count", nullable=false) private int courtCount;
    @Column(name="reference_fee", nullable=false, precision=14, scale=0) private BigDecimal referenceFee;
    @Column(name="quoted_start", nullable=false) private LocalDate quotedStart;
    @Column(name="contract_end", nullable=false) private LocalDate contractEnd;
    @Column(name="quoted_amount", nullable=false, precision=14, scale=0) private BigDecimal quotedAmount;
    @Column(name="proof_path", nullable=false, length=255) private String proofPath;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=10) private ApprovalStatus status;
    @Column(name="effective_start") private LocalDate effectiveStart;
    @Column(name="final_amount", precision=14, scale=0) private BigDecimal finalAmount;
    @Column(name="received_amount", precision=14, scale=0) private BigDecimal receivedAmount;
    @Column(name="refunded_amount", precision=14, scale=0) private BigDecimal refundedAmount;
    @Column(name="settlement_note", length=500) private String settlementNote;
    @Column(name="reject_reason", length=500) private String rejectReason;
    @Column(name="processed_by") private Long processedBy;
    @Column(name="processed_at") private LocalDateTime processedAt;
    @Column(name="created_at", nullable=false) private LocalDateTime createdAt;
}
