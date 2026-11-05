package com.sep490.bms.dto.location;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import com.sep490.bms.entity.location.ServiceTerm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC06 - Một kỳ hạn sử dụng dịch vụ của địa điểm (mỗi kỳ tối thiểu 12 tháng).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceTermDto {

    private Long id;

    private Long locationId;

    private LocalDate startDate;

    private LocalDate endDate;

    /** Số ngày của kỳ hạn. */
    private Long totalDays;

    /** Số ngày còn lại tính từ hôm nay, âm nếu đã hết hạn. */
    private Long daysRemaining;

    /** Hôm nay có nằm trong kỳ hạn này hay không. */
    private Boolean active;

    private Long recordedBy;

    private String recordedByName;

    private LocalDateTime createdAt;

    public static ServiceTermDto fromEntity(ServiceTerm entity, String recordedByName) {
        if (entity == null) {
            return null;
        }
        LocalDate today = LocalDate.now();
        boolean active = !today.isBefore(entity.getStartDate()) && !today.isAfter(entity.getEndDate());
        return ServiceTermDto.builder()
                .id(entity.getId())
                .locationId(entity.getLocationId())
                .startDate(entity.getStartDate())
                .endDate(entity.getEndDate())
                .totalDays(ChronoUnit.DAYS.between(entity.getStartDate(), entity.getEndDate()) + 1)
                .daysRemaining(ChronoUnit.DAYS.between(today, entity.getEndDate()))
                .active(active)
                .recordedBy(entity.getRecordedBy())
                .recordedByName(recordedByName)
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
