package com.sep490.bms.dto.operation;

import java.math.BigDecimal;
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
public class RevenueReportResponse {

    private LocalDate from;
    private LocalDate to;
    /** Tổng tiền các khoản thanh toán đã xác nhận trong kỳ (đã trừ giảm giá voucher và điểm). */
    private BigDecimal totalRevenue;
    /**
     * Doanh thu trước giảm giá = totalRevenue + voucherDiscount + pointDiscount, nên
     * grossRevenue − voucherDiscount − pointDiscount − totalRefunds = netRevenue.
     */
    private BigDecimal grossRevenue;
    /** Giảm giá voucher của các khoản thu trong kỳ. */
    private BigDecimal voucherDiscount;
    /** Giảm giá bằng điểm tích lũy của các khoản thu trong kỳ. */
    private BigDecimal pointDiscount;
    /** Tổng tiền đã hoàn trong kỳ. */
    private BigDecimal totalRefunds;
    private BigDecimal netRevenue;
    private long paymentCount;
    private long refundCount;
    private List<DayItem> daily;

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class DayItem {
        private LocalDate date;
        private BigDecimal revenue;
        private BigDecimal refunds;
        private BigDecimal net;
    }
}
