package com.sep490.bms.dto.operation;

import java.time.LocalDate;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OccupancyReportResponse {

    private LocalDate from;
    private LocalDate to;
    /** Số slot 30 phút có thể bán (theo giờ mở cửa × số sân hoạt động). */
    private long availableSlots;
    private long bookedSlots;
    /** bookedSlots / availableSlots, 0 nếu không có slot khả dụng. */
    private double occupancyRate;
    private List<DayItem> daily;
    private List<CourtItem> byCourt;

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class DayItem {
        private LocalDate date;
        private long availableSlots;
        private long bookedSlots;
        private double occupancyRate;
    }

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class CourtItem {
        private Long courtId;
        private String courtName;
        private long availableSlots;
        private long bookedSlots;
        private double occupancyRate;
    }
}
