package com.sep490.bms.dto.operation;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

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
public class BookingReportResponse {

    private LocalDate from;
    private LocalDate to;
    private long totalBookings;
    /** Booking đã xác nhận, đang dùng hoặc đã hoàn thành. */
    private long validBookings;
    private long cancelledBookings;
    /** cancelledBookings / totalBookings, 0 nếu chưa có booking. */
    private double cancellationRate;
    private Map<String, Long> byStatus;
    private List<DayItem> daily;
    private List<CourtItem> byCourt;

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class DayItem {
        private LocalDate date;
        private long total;
        private long valid;
    }

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class CourtItem {
        private Long courtId;
        private String courtName;
        private long total;
        private long valid;
    }
}
