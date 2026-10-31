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
