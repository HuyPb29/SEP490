package com.sep490.bms.dto.booking;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * UC14, BR64 (D164): đơn đặt lẻ gồm nhiều dải slot trong cùng một ngày tại một địa điểm. Mỗi dải là các slot
 * liền nhau trên một sân và thành một booking. Voucher, điểm áp cho cả đơn; ghi chú cho chủ sân gắn vào mọi
 * booking của đơn (FR35).
 */
public record BookingOrderRequest(
        @NotNull LocalDate date,
        @NotEmpty @Valid List<Range> ranges,
        @Size(max = 20) String voucherCode,
        @Positive Long voucherGrantId,
        @Min(0) Integer pointsToUse,
        @Size(max = 200, message = "Ghi chú tối đa 200 ký tự (MSG109)") String note,
        @Positive Long teamId) {

    @AssertTrue(message = "Chỉ chọn voucherCode hoặc voucherGrantId")
    public boolean isVoucherSelectionValid() {
        return voucherCode == null || voucherCode.isBlank() || voucherGrantId == null;
    }

    /** Một dải: các slot liền nhau trên một sân, giờ tính bằng phút từ 00:00. */
    public record Range(
            @NotNull @Positive Long courtId,
            @Min(0) @Max(1410) int startMinute,
            @Min(30) @Max(1440) int endMinute) {
    }
}
