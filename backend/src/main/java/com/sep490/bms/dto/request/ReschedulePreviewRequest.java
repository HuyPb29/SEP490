package com.sep490.bms.dto.request;

import java.time.LocalDate;

import jakarta.validation.constraints.*;

public record ReschedulePreviewRequest(@NotNull @Positive Long courtId, @NotNull LocalDate date,
        @Min(0) @Max(1410) int startMinute, @Min(30) @Max(1440) int endMinute) {
    @AssertTrue(message="Slot phải theo bước 30 phút và giờ kết thúc sau giờ bắt đầu")
    public boolean isValidSlot() { return startMinute % 30 == 0 && endMinute % 30 == 0 && endMinute > startMinute; }
}
