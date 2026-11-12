package com.sep490.bms.dto.operation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Tổng hợp yêu cầu đổi lịch, lượt đã duyệt và số tiền phụ thu theo ngày.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RescheduleReportResponse {

    private LocalDate from;
    private LocalDate to;
    /** Yêu cầu đổi lịch tạo trong kỳ. */
    private long totalRequests;
    private long approved;
    private long freeRequests;
    private long paidRequests;
    /** Tổng tiền chênh lệch của các yêu cầu đã duyệt. */
    private BigDecimal extraAmount;
    private Map<String, Long> byStatus;
    private List<DayItem> daily;

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class DayItem {
        private LocalDate date;
        private long requests;
        private long approved;
    }
}
