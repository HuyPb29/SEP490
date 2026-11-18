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

    /** Số sân con đang hoạt động. */
    private int activeCourtCount;

    /**
     * Giá thấp nhất cho 1 giờ chơi, quy từ đơn giá slot 30 phút của các mức giá còn hiệu lực hôm nay.
     * Chưa có mức giá nào thì null.
     */
    private BigDecimal minPricePerHour;

    /** Điểm đánh giá trung bình (1 chữ số thập phân) của các đánh giá công khai; chưa có đánh giá thì null. */
    private Double averageRating;

    /** Số đánh giá công khai. */
    private long reviewCount;
}
