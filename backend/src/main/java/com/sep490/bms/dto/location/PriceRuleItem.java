package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Một dòng trong bảng giá công khai của sân (FR30). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PriceRuleItem {

    /** Các thứ áp dụng: 1 = thứ Hai … 7 = Chủ nhật. */
    private List<Integer> applyDays;
    /** "HH:mm". */
    private String startTime;
    /** "HH:mm", có thể là "24:00". */
    private String endTime;
    /** Giá của một slot 30 phút. */
    private BigDecimal pricePerSlot;
    private LocalDate validFrom;
    /** Không có nghĩa là áp dụng đến khi Owner đổi giá. */
    private LocalDate validTo;
}
