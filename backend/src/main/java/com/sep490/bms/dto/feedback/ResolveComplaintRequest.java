package com.sep490.bms.dto.feedback;

import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.PastOrPresent;

import com.sep490.bms.entity.enums.ComplaintResult;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Nhận phương án xử lý khiếu nại, số tiền hoặc điểm bồi hoàn và ghi chú.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResolveComplaintRequest {

    @NotNull(message = "Kết quả xử lý không được để trống")
    private ComplaintResult result;

    /** Số tiền đề xuất hoàn (REFUND); mặc định là số tiền booking. */
    @DecimalMin("1") @Digits(integer = 12, fraction = 0)
    private BigDecimal refundAmount;

    @DecimalMin("1") @Digits(integer = 12, fraction = 0)
    private BigDecimal verifiedUnrecordedAmount;

    @PastOrPresent
    private LocalDate originalTransferDate;

    /** Số điểm bồi thường (POINTS), phải > 0. */
    private Integer compensationPoints;

    @Size(max = 255, message = "Ghi chú tối đa 255 ký tự")
    private String note;
}
