package com.sep490.bms.dto.booking;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.promotion.Voucher;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Chương trình ưu đãi đặt theo lô đang diễn ra, cho Player xem khi đặt nhiều buổi (UC15 #9, FR44, BR47).
 * Không trả mã voucher: voucher được tặng thẳng vào tài khoản khi thanh toán gói được xác nhận.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BatchOfferPublicResponse {

    private Long id;
    private String name;
    private LocalDate startDate;
    private LocalDate endDate;
    /** Gói có tổng số tiền thực trả từ mức này trở lên thì được tặng voucher. */
    private BigDecimal minPackageAmount;
    private String voucherName;
    /** AMOUNT: giảm số tiền; PERCENT: giảm phần trăm. */
    private String discountType;
    private BigDecimal discountValue;

    public static BatchOfferPublicResponse from(BatchOffer offer, Voucher voucher) {
        return BatchOfferPublicResponse.builder()
                .id(offer.getId())
                .name(offer.getName())
                .startDate(offer.getStartDate())
                .endDate(offer.getEndDate())
                .minPackageAmount(offer.getMinPackageAmount())
                .voucherName(voucher.getName())
                .discountType(voucher.getDiscountType() == null ? null : voucher.getDiscountType().name())
                .discountValue(voucher.getDiscountValue())
                .build();
    }
}
