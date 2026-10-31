package com.sep490.bms.dto.location;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC06 - Địa điểm nhìn từ phía Admin: kèm chủ sở hữu, số sân và hạn sử dụng dịch vụ.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminLocationDto {

    private Long id;

    private String name;

    private String address;

    private Double latitude;

    private Double longitude;

    private String contactPhone;

    private String status;

    private LocalDateTime lockedAt;

    private Long ownerId;

    private String ownerName;

    private String ownerEmail;

    private Integer courtCount;

    /** Ngày hết hạn của kỳ hạn dịch vụ xa nhất, null nếu chưa có kỳ hạn nào. */
    private LocalDate serviceTermEndDate;

    /** Địa điểm còn trong hạn sử dụng dịch vụ tại ngày hôm nay hay không. */
    private Boolean serviceActive;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** Chỉ có ở API chi tiết. */
    private List<CourtDto> courts;

    public static AdminLocationDto fromEntity(Location location, Account owner, int courtCount,
            LocalDate serviceTermEndDate, List<CourtDto> courts) {
        if (location == null) {
            return null;
        }
        LocalDate today = LocalDate.now();
        return AdminLocationDto.builder()
                .id(location.getId())
                .name(location.getName())
                .address(location.getAddress())
                .latitude(location.getLatitude() == null ? null : location.getLatitude().doubleValue())
                .longitude(location.getLongitude() == null ? null : location.getLongitude().doubleValue())
                .contactPhone(location.getContactPhone())
                .status(location.getStatus())
                .lockedAt(location.getLockedAt())
                .ownerId(location.getOwnerId())
                .ownerName(owner == null ? null : owner.getFullName())
                .ownerEmail(owner == null ? null : owner.getEmail())
                .courtCount(courtCount)
                .serviceTermEndDate(serviceTermEndDate)
                .serviceActive(serviceTermEndDate != null && !serviceTermEndDate.isBefore(today))
                .createdAt(location.getCreatedAt())
                .updatedAt(location.getUpdatedAt())
                .courts(courts)
                .build();
    }
}
