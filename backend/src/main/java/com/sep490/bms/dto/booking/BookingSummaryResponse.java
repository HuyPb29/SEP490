package com.sep490.bms.dto.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Màn tóm tắt trước khi giữ chỗ (UC14 #3–5, FR38): chỉ tính để hiển thị, không lưu gì. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingSummaryResponse {

    private Long locationId;
    private String locationName;
    private Long courtId;
    private String courtName;
    private LocalDate date;
    /** "HH:mm". */
    private String startTime;
    private String endTime;
    /** Thông tin người đặt, lấy từ tài khoản đang đăng nhập. */
    private String bookerName;
    private String bookerPhone;
    private List<SlotPrice> slots;
    /** Tổng giá niêm yết của các slot. */
    private BigDecimal listAmount;
    private BigDecimal voucherDiscount;
    private BigDecimal pointDiscount;
    /** listAmount − voucherDiscount − pointDiscount (BR41). */
    private BigDecimal finalAmount;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SlotPrice {
        private int startMinute;
        /** "HH:mm". */
        private String time;
        private BigDecimal price;
    }
}
