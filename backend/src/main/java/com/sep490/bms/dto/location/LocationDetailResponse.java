package com.sep490.bms.dto.location;

import java.math.BigDecimal;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Thông tin công khai của một địa điểm (UC12, FR30). Không trả thông tin chuyển khoản, chủ sân, tham số.
 * Danh sách sân và bảng giá lấy ở GET /api/locations/{id}/courts và GET /api/courts/{id}.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationDetailResponse {

    private Long id;
    private String name;
    private String address;
    private String contactPhone;
    private BigDecimal latitude;
    private BigDecimal longitude;
    /** Chỉ các thứ có mở cửa, xếp thứ Hai → Chủ nhật; thứ không có trong danh sách là đóng cửa. */
    private List<OpeningHourItem> openingHours;
}
