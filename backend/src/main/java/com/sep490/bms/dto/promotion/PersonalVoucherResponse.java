package com.sep490.bms.dto.promotion;
import java.time.LocalDateTime;
import com.sep490.bms.entity.enums.VoucherGrantStatus;
public record PersonalVoucherResponse(Long grantId, VoucherGrantStatus grantStatus, LocalDateTime grantedAt,
        LocalDateTime expiresAt, VoucherResponse voucher) {}
