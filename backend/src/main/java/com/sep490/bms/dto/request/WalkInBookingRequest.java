package com.sep490.bms.dto.request;
import java.time.LocalDate;
import jakarta.validation.constraints.*;
public record WalkInBookingRequest(@NotNull @Positive Long courtId,@NotNull LocalDate date,
        @Min(0) @Max(1410) int startMinute,@Min(30) @Max(1440) int endMinute,
        @NotBlank @Size(max=50) String customerName,@NotBlank @Pattern(regexp="0[0-9]{9}") String customerPhone,@Size(max=200) String note) {
    @AssertTrue(message="Slot phải là bội 30 phút và kết thúc sau bắt đầu")
    public boolean isValidSlot() { return startMinute%30==0 && endMinute%30==0 && endMinute>startMinute; }
}
