package com.sep490.bms.dto.request;

import java.time.LocalDate;

import jakarta.validation.constraints.*;

/** Shared selection for summary and creation; discounts are consumed only during creation. */
public record BookingRequest(
        @NotNull @Positive Long courtId,
        @NotNull LocalDate date,
        @Min(0) @Max(1410) int startMinute,
        @Min(30) @Max(1440) int endMinute,
        @Size(max = 20) String voucherCode,
        @Min(0) int pointsToUse) {
    @AssertTrue(message = "Slot phải theo bước 30 phút và giờ kết thúc sau giờ bắt đầu")
    public boolean isValidSlot() {
        return startMinute % 30 == 0 && endMinute % 30 == 0 && endMinute > startMinute;
    }
}
