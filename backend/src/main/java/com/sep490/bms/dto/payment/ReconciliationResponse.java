package com.sep490.bms.dto.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.sep490.bms.entity.payment.Reconciliation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Kết quả đối soát đã lưu của một ngày (UC20 #4, #5). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReconciliationResponse {

    private Long id;
    private Long locationId;
    private LocalDate date;
    /** Tổng số phải trả của các giao dịch đã xác nhận trong ngày, tại lúc lưu (BR37). */
    private BigDecimal systemAmount;
    private BigDecimal actualAmount;
    /** Thực nhận − hệ thống: dương là nhận nhiều hơn, âm là thiếu. */
    private BigDecimal difference;
    private String reason;
    private Long staffId;
    private String staffName;
    private LocalDateTime createdAt;

    public static ReconciliationResponse from(Reconciliation reconciliation, String staffName) {
        return ReconciliationResponse.builder()
                .id(reconciliation.getId())
                .locationId(reconciliation.getLocationId())
                .date(reconciliation.getReconDate())
                .systemAmount(reconciliation.getSystemAmount())
                .actualAmount(reconciliation.getActualAmount())
                // Cột difference do database tính; vừa lưu thì entity chưa đọc lại, nên tính ở đây.
                .difference(reconciliation.getActualAmount().subtract(reconciliation.getSystemAmount()))
                .reason(reconciliation.getReason())
                .staffId(reconciliation.getStaffId())
                .staffName(staffName)
                .createdAt(reconciliation.getCreatedAt())
                .build();
    }
}
