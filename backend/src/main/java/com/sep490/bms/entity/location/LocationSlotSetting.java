package com.sep490.bms.entity.location;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC08 - Cấu hình slot bán sân của địa điểm (FR18).
 *
 * Cấu hình ở cấp ĐỊA ĐIỂM: mọi sân con trong cùng địa điểm dùng chung một cấu hình,
 * nên khoá chính là location_id (quan hệ 1-1 với location, không có cột id riêng).
 * Không có dòng nghĩa là địa điểm đang dùng mặc định 30 phút/slot, không nghỉ, tối đa
 * 4 slot mỗi lần đặt.
 */
@Entity
@Table(name = "location_slot_setting")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationSlotSetting {

    @Id
    @Column(name = "location_id")
    private Long locationId;

    /** Độ dài một slot, bội số 30 (30 - 240). */
    @Column(name = "slot_minutes", nullable = false)
    @Builder.Default
    private short slotMinutes = 30;

    /** Thời gian nghỉ giữa hai slot liên tiếp, bội số 30 (0 - 60). */
    @Column(name = "buffer_minutes", nullable = false)
    @Builder.Default
    private short bufferMinutes = 0;

    /** Số slot tối đa cho một lần đặt (1 - 12). */
    @Column(name = "max_slots_per_booking", nullable = false)
    @Builder.Default
    private short maxSlotsPerBooking = 4;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
