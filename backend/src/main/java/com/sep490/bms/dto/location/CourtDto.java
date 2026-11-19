package com.sep490.bms.dto.location;

import java.time.LocalDateTime;

import com.sep490.bms.entity.location.Court;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Thông tin sân con của địa điểm (UC07). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CourtDto {

    private Long id;
    private java.time.LocalDate availableFrom;
    private java.time.LocalDate availableUntil;
    private Long locationId;
    private String name;
    private String description;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CourtDto fromEntity(Court court) {
        if (court == null) {
            return null;
        }
        return CourtDto.builder()
                .id(court.getId())
                .availableFrom(court.getAvailableFrom())
                .availableUntil(court.getAvailableUntil())
                .locationId(court.getLocationId())
                .name(court.getName())
                .description(court.getDescription())
                .active(court.isActive())
                .createdAt(court.getCreatedAt())
                .updatedAt(court.getUpdatedAt())
                .build();
    }
}
