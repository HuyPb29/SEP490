package com.sep490.bms.entity.location;

import java.math.BigDecimal;
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
 * Lưu hồ sơ đăng ký sử dụng dịch vụ và kết quả xét duyệt.
 */
@Entity
@Table(name = "service_registration")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "requester_id")
    private Long requesterId;

    @Column(name = "location_name", nullable = false, length = 100)
    private String locationName;

    @Column(nullable = false, length = 255)
    private String address;

    @Column(nullable = false, precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(nullable = false, precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(name = "court_count", nullable = false)
    private int courtCount;

    /** Số năm thuê, nguyên, tối thiểu 1 (DR19, DR29). */
    @Column(name = "rental_years", nullable = false)
    private int rentalYears;

    /** Số tiền thuê tham khảo do hệ thống tính theo P35 lúc gửi đơn (BR61). */
    @Column(name = "rental_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal rentalAmount;

    /** Ảnh chứng từ chuyển khoản tiền thuê, đường dẫn tương đối trong thư mục ảnh (A03). */
    @Column(name = "proof_image_path", length = 255)
    private String proofImagePath;

    /** Thời điểm chủ sân đánh dấu đồng ý điều khoản sử dụng dịch vụ (BR65). */
    @Column(name = "terms_accepted_at")
    private LocalDateTime termsAcceptedAt;

    @Column(name = "contact_name", length = 50)
    private String contactName;

    @Column(name = "contact_phone", length = 10)
    private String contactPhone;

    @Column(name = "contact_email", length = 100)
    private String contactEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private ApprovalStatus status = ApprovalStatus.PENDING;

    @Column(name = "reject_reason", length = 500)
    private String rejectReason;

    @Column(name = "processed_by")
    private Long processedBy;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Column(name = "location_id")
    private Long locationId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
