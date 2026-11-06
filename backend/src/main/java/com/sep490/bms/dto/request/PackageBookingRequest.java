package com.sep490.bms.dto.request;

import java.time.LocalDate;
import java.util.List;
import com.sep490.bms.entity.enums.PackageType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

/** UC15: recurring pattern or custom sessions; replacements also represent dropped conflicts. */
public record PackageBookingRequest(@NotNull @Positive Long courtId,@NotNull PackageType packageType,
        @NotNull LocalDate startDate,@NotNull LocalDate endDate,@Positive Long teamId,
        List<@NotNull @Valid Pattern> pattern,List<@NotNull @Valid Slot> sessions,List<@NotNull @Valid Replacement> replacements,
        @Size(max=20) String voucherCode,@Positive Long voucherGrantId,@Min(0) Integer pointsToUse,@Size(max=200) String note) {
    public record Pattern(@Min(1) @Max(7) int dayOfWeek,@Min(0) int startMinute,@Max(1440) int endMinute) {}
    public record Slot(@NotNull @Positive Long courtId,@NotNull LocalDate date,@Min(0) int startMinute,@Max(1440) int endMinute) {}
    public record Replacement(@NotNull @Valid Slot original,@Valid Slot replacement) {}
}
