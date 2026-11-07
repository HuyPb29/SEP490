package com.sep490.bms.dto.location;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.sep490.bms.entity.Location;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Chi tiết địa điểm cho Owner (UC07) - có thông tin ngân hàng và cấu hình đặt sân.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationDetailDto {

    private Long id;
    private String name;
    private String address;
    private Double latitude;
    private Double longitude;
    private String contactPhone;

    private String bankName;
    private String bankAccountNo;
    private String bankAccountHolder;
    private String qrImagePath;

    private Short advanceBookingDays;
    private Integer pointEarningRate;

    /** Ngày hết hạn kỳ hạn dịch vụ gần nhất; null = địa điểm chưa được ghi nhận kỳ hạn nào. */
    private LocalDate serviceTermEndDate;

    /** Kỳ hạn còn hiệu lực tại hôm nay hay không (địa điểm chưa có kỳ hạn = false). */
    private boolean serviceActive;

    private String status;
    private LocalDateTime lockedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private List<CourtDto> courts;

    public static LocationDetailDto fromEntity(Location location, List<CourtDto> courts,
            LocalDate serviceTermEndDate) {
        if (location == null) {
            return null;
        }
        return LocationDetailDto.builder()
                .id(location.getId())
                .name(location.getName())
                .address(location.getAddress())
                .latitude(location.getLatitude() == null ? null : location.getLatitude().doubleValue())
                .longitude(location.getLongitude() == null ? null : location.getLongitude().doubleValue())
                .contactPhone(location.getContactPhone())
                .bankName(location.getBankName())
                .bankAccountNo(location.getBankAccountNo())
                .bankAccountHolder(location.getBankAccountHolder())
                .qrImagePath(location.getQrImagePath())
                .advanceBookingDays(location.getAdvanceBookingDays())
                .pointEarningRate(location.getPointEarningRate())
                .serviceTermEndDate(serviceTermEndDate)
                .serviceActive(serviceTermEndDate != null && !serviceTermEndDate.isBefore(LocalDate.now()))
                .status(location.getStatus())
                .lockedAt(location.getLockedAt())
                .createdAt(location.getCreatedAt())
                .updatedAt(location.getUpdatedAt())
                .courts(courts)
                .build();
    }
}
