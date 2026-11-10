package com.sep490.bms.repository.payment;

import java.math.BigDecimal;

/**
 * Tổng các giao dịch đã xác nhận của một địa điểm trong một khoảng thời gian (UC20 #1, FR61).
 * SUM trả null khi không có dòng nào, nên đổi về 0 ở đây.
 *
 * @param count          số giao dịch đã xác nhận
 * @param amountDue      tổng số phải trả, tức doanh thu ghi nhận (BR37)
 * @param receivedAmount tổng số Staff ghi nhận đã nhận; lớn hơn amountDue khi khách chuyển thừa (BR51)
 */
public record ConfirmedPaymentTotal(long count, BigDecimal amountDue, BigDecimal receivedAmount) {

    public ConfirmedPaymentTotal(Long count, BigDecimal amountDue, BigDecimal receivedAmount) {
        this(count == null ? 0 : count.longValue(),
                amountDue == null ? BigDecimal.ZERO : amountDue,
                receivedAmount == null ? BigDecimal.ZERO : receivedAmount);
    }
}
