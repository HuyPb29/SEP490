package com.sep490.bms.dto.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.PackageType;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Một gói đặt nhiều buổi trong danh sách booking của Player (UC17 #1, FR51).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackageListItem {

    private Long id;
    /** Định kỳ hoặc tự chọn: chỉ là cách nhập buổi lúc đặt (D104). */
    private PackageType packageType;
    private Long locationId;
    private String locationName;
    private LocalDate startDate;
    private LocalDate endDate;
    private long sessionCount;
    private BigDecimal finalAmount;
    /** Trạng thái thanh toán của gói; Đang giữ chỗ đã quá hạn hiện là Hết hạn (BR03). */
    private BookingStatus status;
    /** Chỉ có khi đang giữ chỗ: mốc để đếm ngược (FR52). */
    private LocalDateTime holdExpiresAt;
    private LocalDateTime createdAt;
}
