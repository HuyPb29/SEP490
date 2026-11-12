package com.sep490.bms.dto.request;

import com.sep490.bms.entity.enums.AffectedChoice;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

/**
 * Nhận phương án xử lý booking bị ảnh hưởng và slot đích nếu Player chọn đổi lịch.
 */
public record AffectedChoiceRequest(@NotNull AffectedChoice choice, @Valid ReschedulePreviewRequest slot) {
    @AssertTrue(message = "Chọn đổi lịch phải cung cấp slot mới; hoàn tiền/điểm không nhận slot")
    public boolean isValidChoice() { return (choice == AffectedChoice.RESCHEDULE) == (slot != null); }
}
