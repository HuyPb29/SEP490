package com.sep490.bms.dto.payment;

import java.math.BigDecimal;
import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * UC20 #1, FR61: số liệu hệ thống của một ngày để Staff so với sao kê ngân hàng và tiền mặt.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReconciliationSummaryResponse {

    private Long locationId;
    private LocalDate date;
    /** Số giao dịch đã xác nhận trong ngày. */
    private long confirmedCount;
    /** Tổng số phải trả của các giao dịch đó, tức doanh thu ghi nhận trong ngày (BR37). Đây là số đem so. */
    private BigDecimal systemAmount;
    /**
     * Tiền khách chuyển thừa mà Staff đã nhập khi xác nhận (BR51). Không tính vào doanh thu nhưng có trong
     * sao kê, nên hiện riêng để Staff biết một phần chênh lệch đến từ đâu.
     */
    private BigDecimal overpaidAmount;
}
