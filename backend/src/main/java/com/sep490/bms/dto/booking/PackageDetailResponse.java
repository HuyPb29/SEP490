package com.sep490.bms.dto.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.PackageType;
import com.sep490.bms.entity.enums.PaymentStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Chi tiết một gói đặt nhiều buổi cho Player (UC17 #3–5): số tiền, trạng thái thanh toán của cả gói
 * và danh sách buổi. Mỗi buổi có trạng thái riêng (đổi lịch, hủy từng buổi, BR28); xem từng buổi
 * ở GET /api/bookings/{id}.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackageDetailResponse {

    private Long id;
    private PackageType packageType;
    private Long locationId;
    private String locationName;
    private String locationAddress;
    private LocalDate startDate;
    private LocalDate endDate;

    private BigDecimal listAmount;
    private BigDecimal voucherDiscount;
    private int pointsUsed;
    private BigDecimal pointDiscount;
    private BigDecimal finalAmount;

    /** Đang giữ chỗ đã quá hạn hiện là Hết hạn (BR03). */
    private BookingStatus status;
    /** Chỉ có khi đang giữ chỗ: mốc để đếm ngược (FR52). */
    private LocalDateTime holdExpiresAt;
    private LocalDateTime createdAt;

    /** Trống khi Player chưa báo thanh toán gói. Nút Gửi lại chứng từ đi theo paymentId. */
    private Long paymentId;
    private PaymentStatus paymentStatus;
    private String resubmitReason;
    private LocalDateTime resubmitDeadline;
    private String receiptNo;

    /** Các buổi của gói theo ngày giờ chơi. */
    private List<BookingListItem> sessions;
}
