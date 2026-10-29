package com.sep490.bms.dto.promotion;
import java.math.BigDecimal;
public record VoucherCheckResponse(Long voucherId, Long grantId, BigDecimal orderAmount, BigDecimal discountAmount, BigDecimal amountAfterVoucher) {}
