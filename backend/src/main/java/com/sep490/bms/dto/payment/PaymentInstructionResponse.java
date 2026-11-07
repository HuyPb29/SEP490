package com.sep490.bms.dto.payment;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.sep490.bms.entity.enums.BookingStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Màn thanh toán (UC18 #1, FR55): số tiền, thông tin nhận chuyển khoản của địa điểm (DR28)
 * và thời gian giữ chỗ còn lại (BR03).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentInstructionResponse {

    /** Booking lẻ: bookingId, bookingCode. Gói đặt nhiều buổi (UC15): packageId. */
    private Long bookingId;
    private String bookingCode;
    private Long packageId;
    /** HOLDING: lần đầu báo thanh toán. RESUBMIT_REQUESTED: chuyển thêm hoặc gửi lại chứng từ. */
    private BookingStatus status;
    private BigDecimal amountDue;
    private String bankName;
    private String bankAccountNo;
    private String bankAccountHolder;
    /**
     * Đường dẫn API trả ảnh mã QR (cần token, A03). Trống khi địa điểm chưa có ảnh QR.
     * Màn hình tải ảnh này để hiện và cho Player lưu về máy.
     */
    private String qrImageUrl;
    /** Chỉ có khi đang giữ chỗ; màn hình đếm ngược tới thời điểm này (MSG32). */
    private LocalDateTime holdExpiresAt;
}
