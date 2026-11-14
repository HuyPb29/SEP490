package com.sep490.bms.dto.promotion;
import java.time.LocalDateTime;
import com.sep490.bms.entity.enums.VoucherGrantStatus;
/**
 * Trả thông tin voucher được cấp riêng cho Player, gồm trạng thái và hạn của lượt cấp.
 */
public record PersonalVoucherResponse(Long grantId, VoucherGrantStatus grantStatus, LocalDateTime grantedAt,
        LocalDateTime expiresAt, VoucherResponse voucher) {}
