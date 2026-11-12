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
 * Tổng hợp lượt dùng, lượt trả và số tiền giảm theo voucher trong kỳ báo cáo.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoucherReportResponse {

    private LocalDate from;
    private LocalDate to;
    /** Lượt dùng đang hiệu lực (không tính lượt đã hoàn trả). */
    private long usedCount;
    private long returnedCount;
    private BigDecimal totalDiscount;
    private List<VoucherItem> vouchers;

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class VoucherItem {
        private Long voucherId;
        private String name;
        private String code;
        private String source;
        private long usedCount;
        private long returnedCount;
        private BigDecimal totalDiscount;
    }
}
