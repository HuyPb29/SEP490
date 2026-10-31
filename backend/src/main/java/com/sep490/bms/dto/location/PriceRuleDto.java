package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.sep490.bms.entity.location.PriceRule;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC09 - Một dòng bảng giá của sân (FR19).
 *
 * applyDays là mặt nạ 7 ký tự đúng như trong DB; days/dayLabels là dạng dễ đọc cho client.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PriceRuleDto {

    private Long id;

    private Long courtId;

    private String courtName;

    private String applyDays;

    /** Các thứ áp dụng theo ISO: 1 = Thứ 2 ... 7 = Chủ nhật. */
    private List<Integer> days;

    private List<String> dayLabels;

    private Integer startMinute;

    private Integer endMinute;

    private String startTime;

    private String endTime;

    private Integer durationMinutes;

    private BigDecimal pricePerSlot;

    private LocalDate validFrom;

    private LocalDate validTo;

    /** Còn hiệu lực tại ngày hôm nay hay không (valid_to null = không giới hạn). */
    private Boolean active;

    private LocalDateTime createdAt;

    public static PriceRuleDto fromEntity(PriceRule entity, String courtName) {
        if (entity == null) {
            return null;
        }
        LocalDate today = LocalDate.now();
        boolean active = entity.getValidTo() == null || !entity.getValidTo().isBefore(today);
        return PriceRuleDto.builder()
                .id(entity.getId())
                .courtId(entity.getCourtId())
                .courtName(courtName)
                .applyDays(entity.getApplyDays())
                .days(ApplyDays.toDays(entity.getApplyDays()))
                .dayLabels(ApplyDays.toLabels(entity.getApplyDays()))
                .startMinute(entity.getStartMinute())
                .endMinute(entity.getEndMinute())
                .startTime(OpeningTime.toTime(entity.getStartMinute()))
                .endTime(OpeningTime.toTime(entity.getEndMinute()))
                .durationMinutes(entity.getEndMinute() - entity.getStartMinute())
                .pricePerSlot(entity.getPricePerSlot())
                .validFrom(entity.getValidFrom())
                .validTo(entity.getValidTo())
                .active(active)
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
