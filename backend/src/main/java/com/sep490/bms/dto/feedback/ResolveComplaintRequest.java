package com.sep490.bms.dto.feedback;

import java.math.BigDecimal;

import com.sep490.bms.entity.enums.ComplaintResult;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
public class ResolveComplaintRequest {

    @NotNull(message = "Kết quả xử lý không được để trống")
    private ComplaintResult result;

    /** Số tiền đề xuất hoàn (REFUND); mặc định là số tiền booking. */
    private BigDecimal refundAmount;

    /** Số điểm bồi thường (POINTS), phải > 0. */
    private Integer compensationPoints;

    @Size(max = 255, message = "Ghi chú tối đa 255 ký tự")
    private String note;
}
