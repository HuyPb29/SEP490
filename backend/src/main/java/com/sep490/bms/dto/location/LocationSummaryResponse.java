package com.sep490.bms.dto.location;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Một dòng trong danh sách địa điểm và một điểm ghim trên bản đồ (UC11, FR27, FR28). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationSummaryResponse {

    private Long id;
    private String name;
    private String address;
    private BigDecimal latitude;
    private BigDecimal longitude;

    /** Khoảng cách đường thẳng (km) đến vị trí người dùng; không gửi vị trí thì không có (FR29). */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Double distanceKm;
}
