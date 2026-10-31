package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.promotion.Voucher;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 * UC09 - Ưu đãi đặt theo lô của địa điểm (FR19).
 *
 * batch_offer chỉ lưu voucher_id, nên DTO kèm theo thông tin voucher để client
 * hiển thị được mức giảm giá mà không phải gọi thêm API của F6.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BatchOfferDto {

    private Long id;

    private Long locationId;

    private String name;

    private LocalDate startDate;

    private LocalDate endDate;

    private BigDecimal minPackageAmount;

    private Long voucherId;

    private String voucherCode;

    private String voucherName;

    private String discountType;

    private BigDecimal discountValue;

    private String voucherStatus;

    /** Ưu đãi còn trong thời gian áp dụng tại ngày hôm nay hay không. */
    private Boolean active;

    private LocalDateTime createdAt;

    public static BatchOfferDto fromEntity(BatchOffer entity, Voucher voucher) {
        if (entity == null) {
            return null;
        }
        LocalDate today = LocalDate.now();
        boolean active = !today.isBefore(entity.getStartDate()) && !today.isAfter(entity.getEndDate());
        return BatchOfferDto.builder()
                .id(entity.getId())
                .locationId(entity.getLocationId())
                .name(entity.getName())
                .startDate(entity.getStartDate())
                .endDate(entity.getEndDate())
                .minPackageAmount(entity.getMinPackageAmount())
                .voucherId(entity.getVoucherId())
                .voucherCode(voucher == null ? null : voucher.getCode())
                .voucherName(voucher == null ? null : voucher.getName())
                .discountType(voucher == null || voucher.getDiscountType() == null
                        ? null
                        : voucher.getDiscountType().name())
                .discountValue(voucher == null ? null : voucher.getDiscountValue())
                .voucherStatus(voucher == null || voucher.getStatus() == null
                        ? null
                        : voucher.getStatus().name())
                .active(active)
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
