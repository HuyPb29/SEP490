package com.sep490.bms.dto.location;

import java.time.LocalDateTime;

import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.LocationSlotSetting;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Cấu hình slot của địa điểm (FR18).
 *
 * Cấu hình thuộc về ĐỊA ĐIỂM nên DTO trả cả locationId/locationName: client biết
 * đang xem cấu hình chung của cả cụm sân, không phải riêng sân trên path.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SlotSettingDto {

    public static final int DEFAULT_SLOT_MINUTES = 30;
    public static final int DEFAULT_BUFFER_MINUTES = 0;
    public static final int DEFAULT_MAX_SLOTS = 4;

    private Long locationId;

    private String locationName;

    /** Sân trên path - chỉ để client đối chiếu, cấu hình áp cho mọi sân cùng địa điểm. */
    private Long courtId;

    private String courtName;

    private Integer slotMinutes;

    private Integer bufferMinutes;

    private Integer maxSlotsPerBooking;

    /** Thời lượng thực tế chiếm lịch của một slot = slotMinutes + bufferMinutes. */
    private Integer slotSpanMinutes;

    /** true nếu địa điểm đã lưu cấu hình riêng, false nếu đang dùng giá trị mặc định. */
    private Boolean configured;

    private LocalDateTime updatedAt;

    public static SlotSettingDto fromEntity(LocationSlotSetting entity, Location location, Court court) {
        boolean configured = entity != null;
        int slotMinutes = configured ? entity.getSlotMinutes() : DEFAULT_SLOT_MINUTES;
        int bufferMinutes = configured ? entity.getBufferMinutes() : DEFAULT_BUFFER_MINUTES;
        int maxSlots = configured ? entity.getMaxSlotsPerBooking() : DEFAULT_MAX_SLOTS;
        return SlotSettingDto.builder()
                .locationId(location == null ? null : location.getId())
                .locationName(location == null ? null : location.getName())
                .courtId(court == null ? null : court.getId())
                .courtName(court == null ? null : court.getName())
                .slotMinutes(slotMinutes)
                .bufferMinutes(bufferMinutes)
                .maxSlotsPerBooking(maxSlots)
                .slotSpanMinutes(slotMinutes + bufferMinutes)
                .configured(configured)
                .updatedAt(configured ? entity.getUpdatedAt() : null)
                .build();
    }
}
