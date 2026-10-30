package com.sep490.bms.dto.location;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Thông tin công khai của một sân (UC12, FR30). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CourtResponse {

    private Long id;
    private Long locationId;
    private String name;
    private String description;
    /** Bảng giá: chỉ có ở GET /api/courts/{id}, không có trong danh sách sân. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<PriceRuleItem> priceRules;
}
