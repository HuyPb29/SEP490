package com.sep490.bms.dto.location;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import com.sep490.bms.entity.location.Maintenance;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC10 - Một yêu cầu bảo trì sân (FR23–FR25).
 *
 * Bảng maintenance không có cột lý do từ chối, nên khi Owner từ chối, lý do được
 * ghi nối vào cột reason theo dấu phân cách bên dưới. DTO tách lại thành hai
 * trường reason / rejectReason để client không phải biết chi tiết lưu trữ này.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MaintenanceRequestDto {

    /** Dấu phân cách giữa lý do bảo trì gốc và lý do từ chối trong cột reason. */
    public static final String REJECT_NOTE_SEPARATOR = " | Từ chối: ";

    private Long id;

    private Long courtId;

    private String courtName;

    private Long locationId;

    private LocalDateTime startAt;

    private LocalDateTime endAt;

    /** Thời lượng bảo trì tính bằng phút. */
    private Integer durationMinutes;

    private String reason;

    /** Chỉ có giá trị khi Owner đã từ chối yêu cầu. */
    private String rejectReason;

    private String status;

    private Long requestedBy;

    private String requesterName;

    private Long approvedBy;

    private String approverName;

    private LocalDateTime decidedAt;

    private LocalDateTime createdAt;

    public static MaintenanceRequestDto fromEntity(Maintenance entity, String courtName, Long locationId,
            String requesterName, String approverName) {
        if (entity == null) {
            return null;
        }
        String rawReason = entity.getReason() == null ? "" : entity.getReason();
        String reason = rawReason;
        String rejectReason = null;
        int separatorIndex = rawReason.indexOf(REJECT_NOTE_SEPARATOR);
        if (separatorIndex >= 0) {
            reason = rawReason.substring(0, separatorIndex);
            rejectReason = rawReason.substring(separatorIndex + REJECT_NOTE_SEPARATOR.length());
        }
        Integer duration = entity.getStartAt() == null || entity.getEndAt() == null
                ? null
                : (int) ChronoUnit.MINUTES.between(entity.getStartAt(), entity.getEndAt());
        return MaintenanceRequestDto.builder()
                .id(entity.getId())
                .courtId(entity.getCourtId())
                .courtName(courtName)
                .locationId(locationId)
                .startAt(entity.getStartAt())
                .endAt(entity.getEndAt())
                .durationMinutes(duration)
                .reason(reason)
                .rejectReason(rejectReason)
                .status(entity.getStatus() == null ? null : entity.getStatus().name())
                .requestedBy(entity.getRequestedBy())
                .requesterName(requesterName)
                .approvedBy(entity.getApprovedBy())
                .approverName(approverName)
                .decidedAt(entity.getDecidedAt())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
