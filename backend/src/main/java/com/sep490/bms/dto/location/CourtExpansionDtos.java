package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import jakarta.validation.constraints.*;

public final class CourtExpansionDtos {
    private CourtExpansionDtos() {}
    public record Submit(@Min(1) @Max(100) int courtCount,
                         @NotNull LocalDate quotedStart, @NotNull LocalDate contractEnd,
                         @NotNull @DecimalMin("1") BigDecimal quotedAmount) {}
    /** Số tiền hoàn là khoản Admin đã thực hiện ngoài hệ thống, không phải lệnh chuyển tiền. */
    public record Decision(@NotNull @DecimalMin("0") @Digits(integer=12, fraction=0) BigDecimal receivedAmount,
                           @NotNull @DecimalMin("0") @Digits(integer=12, fraction=0) BigDecimal refundedAmount,
                           @Size(max=500) String settlementNote,
                           @Size(max=500) String reason,
                           LocalDate effectiveStart, BigDecimal finalAmount) {}
    /** months: số tháng tính tiền (D173, phần lẻ quá 15 ngày tính thêm một tháng). */
    public record Quote(int courtCount, LocalDate startDate, LocalDate endDate, int months,
                        BigDecimal amount, BigDecimal referenceFee) {}
    public record View(Long id, Long locationId, String locationName, int courtCount, String status,
                       LocalDate quotedStart, LocalDate contractEnd, BigDecimal quotedAmount,
                       LocalDate effectiveStart, BigDecimal finalAmount, BigDecimal receivedAmount,
                       BigDecimal refundedAmount, String settlementNote, String rejectReason,
                       LocalDateTime createdAt, LocalDateTime processedAt, Quote approvalQuote) {}
}
