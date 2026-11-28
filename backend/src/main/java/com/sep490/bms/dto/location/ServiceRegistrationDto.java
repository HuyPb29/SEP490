package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.sep490.bms.entity.location.ServiceRegistration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC05 - Một đơn đăng ký sử dụng dịch vụ (FR13).
 *
 * locationId chỉ có giá trị sau khi đơn được duyệt: lúc đó hệ thống mới tạo địa điểm thật.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceRegistrationDto {

    private Long id;

    private Long requesterId;

    private String requesterName;

    private String locationName;

    private String address;

    private BigDecimal latitude;

    private BigDecimal longitude;

    private Integer courtCount;

    private Integer rentalYears;

    /** Số tiền thuê tham khảo theo P35, hiện cho Admin khi duyệt (FR11). */
    private BigDecimal rentalAmount;

    /** Đơn có ảnh chứng từ chuyển khoản; Admin xem ảnh qua GET /api/admin/service-registrations/{id}/proof. */
    private boolean hasProof;

    private LocalDateTime termsAcceptedAt;

    private boolean hasIdentityDocument;

    private boolean hasBusinessLicense;

    private LocalDateTime privacyAcceptedAt;

    private String contactName;

    private String contactPhone;

    private String contactEmail;

    private String status;

    private String rejectReason;

    private Long processedBy;

    private LocalDateTime processedAt;

    private Long locationId;

    private LocalDateTime createdAt;

    public static ServiceRegistrationDto fromEntity(ServiceRegistration entity, String requesterName) {
        if (entity == null) {
            return null;
        }
        return ServiceRegistrationDto.builder()
                .id(entity.getId())
                .requesterId(entity.getRequesterId())
                .requesterName(requesterName)
                .locationName(entity.getLocationName())
                .address(entity.getAddress())
                .latitude(entity.getLatitude())
                .longitude(entity.getLongitude())
                .courtCount(entity.getCourtCount())
                .rentalYears(entity.getRentalYears())
                .rentalAmount(entity.getRentalAmount())
                .hasProof(entity.getProofImagePath() != null && !entity.getProofImagePath().isBlank())
                .termsAcceptedAt(entity.getTermsAcceptedAt())
                .hasIdentityDocument(entity.getIdentityDocumentPath() != null && !entity.getIdentityDocumentPath().isBlank())
                .hasBusinessLicense(entity.getBusinessLicensePath() != null && !entity.getBusinessLicensePath().isBlank())
                .privacyAcceptedAt(entity.getPrivacyAcceptedAt())
                .contactName(entity.getContactName())
                .contactPhone(entity.getContactPhone())
                .contactEmail(entity.getContactEmail())
                .status(entity.getStatus() == null ? null : entity.getStatus().name())
                .rejectReason(entity.getRejectReason())
                .processedBy(entity.getProcessedBy())
                .processedAt(entity.getProcessedAt())
                .locationId(entity.getLocationId())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
