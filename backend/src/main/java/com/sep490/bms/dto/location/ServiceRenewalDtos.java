package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import jakarta.validation.constraints.*;

public final class ServiceRenewalDtos {
    private ServiceRenewalDtos() {}
    public record Quote(int rentalYears, int courtCount, LocalDate previousEnd, LocalDate startDate, LocalDate endDate, BigDecimal amount) {}
    public record Submit(@Min(1) @Max(10) int rentalYears, @NotNull LocalDate quotedStart,
                         @NotNull LocalDate quotedEnd, @NotNull BigDecimal quotedAmount,
                         @AssertTrue boolean termsAccepted) {}
    public record Decision(boolean paymentConfirmed, @Size(max=500) String reason) {}
    public record View(Long id, Long locationId, String locationName, int rentalYears, int courtCount,
                       LocalDate startDate, LocalDate endDate, BigDecimal amount, String status,
                       String rejectReason, LocalDateTime createdAt, LocalDateTime processedAt) {}
}
