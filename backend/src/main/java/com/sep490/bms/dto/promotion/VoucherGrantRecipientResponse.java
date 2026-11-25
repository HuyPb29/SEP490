package com.sep490.bms.dto.promotion;

import java.time.LocalDateTime;
import com.sep490.bms.entity.enums.VoucherGrantStatus;

public record VoucherGrantRecipientResponse(Long grantId, Long playerId, String username, String fullName,
        VoucherGrantStatus status, LocalDateTime grantedAt, LocalDateTime expiresAt) {}
