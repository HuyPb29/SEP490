package com.sep490.bms.dto.response;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.sep490.bms.entity.reschedule.RefundRequest;
import java.math.BigDecimal;

public record RefundResponse(
        @JsonUnwrapped RefundRequest refund,
        String bookingCode,
        BigDecimal remainingRefundableAmount) {}
