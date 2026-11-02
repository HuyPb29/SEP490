package com.sep490.bms.dto.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Lịch sân theo ngày của một địa điểm (UC13, FR32): mỗi hàng một sân, mọi sân có cùng dãy cột slot. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleResponse {

    private LocalDate date;
    /** Ngày xa nhất người đang xem được phép xem; FE dùng để khóa nút chuyển ngày. */
    private LocalDate maxDate;
    private List<CourtRow> courts;

    /** Trạng thái slot (FR33), thêm PAST cho slot trống đã qua giờ của hôm nay. */
    public enum SlotStatus {
        AVAILABLE, HOLDING, BOOKED, IN_USE, MAINTENANCE, CLOSED, PAST
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CourtRow {
        private Long courtId;
        private String name;
        private List<SlotCell> slots;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SlotCell {
        private int startMinute;
        /** "HH:mm". */
        private String time;
        private SlotStatus status;
        /** Giá niêm yết hiện tại của slot; slot ngoài giờ mở cửa không có giá. */
        private BigDecimal price;
        /** Ba trường dưới chỉ có khi Owner, Staff của địa điểm xem slot đã có booking (FR34, FR35, BR57). */
        private String bookerName;
        private String bookerPhone;
        private String note;
    }
}
