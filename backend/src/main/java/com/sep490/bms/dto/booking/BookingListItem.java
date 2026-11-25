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
 * Một dòng trong danh sách booking của Player (UC17 #1, FR51). Dùng cả cho danh sách buổi của gói.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingListItem {

    private Long id;
    private String bookingCode;
    private Long locationId;
    private String locationName;
    private String courtName;
    private LocalDate playDate;
    /** Giờ dạng HH:mm, ví dụ "18:00"; 24 giờ là "24:00". */
    private String startTime;
    private String endTime;
    private BigDecimal listAmount;
    private Long bookedHalfHours;
    private BigDecimal finalAmount;
    /** Phụ thu đổi lịch đã được xác nhận; giá gốc finalAmount không thay đổi. */
    @Builder.Default
    private BigDecimal rescheduleSurcharge = BigDecimal.ZERO;

    public BigDecimal getTotalAmount() {
        return (finalAmount == null ? BigDecimal.ZERO : finalAmount)
                .add(rescheduleSurcharge == null ? BigDecimal.ZERO : rescheduleSurcharge);
    }
    /** Đang giữ chỗ đã quá hạn hiện là Hết hạn, dù job UC37 chưa kịp đổi trạng thái (BR03). */
    private BookingStatus status;
    /** Chỉ có khi đang giữ chỗ: màn hình đếm ngược đến mốc này (FR52, MSG32). */
    private LocalDateTime holdExpiresAt;
    private LocalDateTime createdAt;
    /** UC31: booking đã hoàn thành và chưa được đánh giá thì hiện nút Đánh giá. */
    private boolean canReview;
    private RescheduleEligibility reschedule;
    /** Các lần đổi lịch thành công: đổi từ slot nào sang slot nào (UC17, UC21). */
    @Builder.Default
    private java.util.List<RescheduleChange> rescheduleChanges = java.util.List.of();
}
