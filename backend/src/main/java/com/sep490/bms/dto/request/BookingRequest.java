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
        @Positive Long voucherGrantId,
        @Min(0) Integer pointsToUse,
        /** Ghi chú cho chủ sân, không bắt buộc (FR35, DR20). Chỉ lưu khi tạo booking. */
        @Size(max = 200, message = "Ghi chú tối đa 200 ký tự (MSG109)") String note) {
    @AssertTrue(message = "Chỉ chọn voucherCode hoặc voucherGrantId")
    public boolean isVoucherSelectionValid() {
        return voucherCode == null || voucherCode.isBlank() || voucherGrantId == null;
    }
    @AssertTrue(message = "Slot phải theo bước 30 phút và giờ kết thúc sau giờ bắt đầu")
    public boolean isValidSlot() {
        return startMinute % 30 == 0 && endMinute % 30 == 0 && endMinute > startMinute;
    }
}
