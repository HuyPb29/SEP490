package com.sep490.bms.dto.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.BookingStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Một booking tại quầy cho Staff xem (UC16): kết quả khi tạo, khi xác nhận, và một dòng trong danh sách.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WalkInBookingItem {

    private Long id;
    private String bookingCode;
    private Long courtId;
    private String courtName;
    private LocalDate playDate;
    /** Giờ dạng HH:mm, ví dụ "18:00"; 24 giờ là "24:00". */
    private String startTime;
    private String endTime;
    private String customerName;
    private String customerPhone;
    /** Số tiền khách phải trả = giá niêm yết, không có ưu đãi (BR43). */
    private BigDecimal finalAmount;
    /** Đang giữ chỗ đã quá hạn hiện là Hết hạn, dù job UC37 chưa kịp đổi trạng thái (BR03). */
    private BookingStatus status;
    /** Chỉ có khi đang giữ chỗ: Staff phải xác nhận trước mốc này (MSG45). */
    private LocalDateTime holdExpiresAt;
    private LocalDateTime createdAt;
    /** Chỉ có khi Staff đã xác nhận: payment Đã xác nhận, số biên nhận và lúc xác nhận (FR48, FR57). */
    private Long paymentId;
    private String receiptNo;
    private LocalDateTime confirmedAt;
}
