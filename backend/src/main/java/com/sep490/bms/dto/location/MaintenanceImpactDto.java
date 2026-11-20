package com.sep490.bms.dto.location;

import java.time.LocalDate;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

/** MSG15: chỉ trả thông tin booking thuộc địa điểm Owner đang chọn. */
public record MaintenanceImpactDto(Long maintenanceId, Long locationId, String courtName,
        int affectedCount, List<BookingItem> bookings) {
    public record BookingItem(Long id, int version, String bookingCode, LocalDate playDate,
            String startTime, String endTime, String bookingType) {}
    public record Reference(@NotNull @Positive Long id, @NotNull @Min(0) Integer version) {}
    /** NULL/rỗng chỉ được duyệt khi thực tế không có booking bị ảnh hưởng. */
    public record Approval(List<@NotNull @Valid Reference> expectedBookings) {}
}
