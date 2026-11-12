package com.sep490.bms.dto.operation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Tổng hợp lượt hủy theo bên hủy và số tiền hoàn trong kỳ báo cáo.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CancellationReportResponse {

    private LocalDate from;
    private LocalDate to;
    /** Booking có ngày chơi trong kỳ và đã bị hủy. */
    private long totalCancelled;
    private long cancelledByPlayer;
    private long cancelledByFacility;
    /** Tổng giá trị thành tiền của các booking đã hủy. */
    private BigDecimal cancelledAmount;
    private long refundRequests;
    private BigDecimal refundedAmount;
    private List<DayItem> daily;

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class DayItem {
        private LocalDate date;
        private long cancelledByPlayer;
        private long cancelledByFacility;
    }
}
