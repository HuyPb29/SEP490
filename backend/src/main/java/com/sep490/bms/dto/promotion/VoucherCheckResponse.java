package com.sep490.bms.dto.promotion;
import java.math.BigDecimal;
/**
 * Trả số tiền giảm và số tiền còn lại sau khi kiểm tra voucher.
 */
public record VoucherCheckResponse(Long voucherId, Long grantId, BigDecimal orderAmount, BigDecimal discountAmount,
        BigDecimal amountAfterVoucher, boolean allowPoints, Integer maxPointPercent) {
    public int pointPercent() {
        return allowPoints ? maxPointPercent : 0;
    }
}
