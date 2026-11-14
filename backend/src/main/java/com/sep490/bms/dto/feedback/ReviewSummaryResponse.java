package com.sep490.bms.dto.feedback;

import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** UC12 – tổng hợp đánh giá công khai của một địa điểm, hiển thị trên trang chi tiết cơ sở. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewSummaryResponse {

    private Long locationId;
    /** Điểm trung bình làm tròn 1 chữ số thập phân; null khi chưa có đánh giá. */
    private Double averageRating;
    private long reviewCount;
    /** Số đánh giá theo mức sao, đủ khóa 1–5 (mức không có đánh giá là 0). */
    private Map<Integer, Long> ratingCounts;
}
