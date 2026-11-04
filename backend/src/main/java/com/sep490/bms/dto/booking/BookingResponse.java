package com.sep490.bms.dto.booking;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Kết quả khi Player bấm Xác nhận (UC14 #6–8): booking đang giữ chỗ.
 * Màn hình dùng holdExpiresAt để đếm ngược (MSG32), rồi chuyển sang thanh toán.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingResponse {

    private Long id;
    private String bookingCode;
    private BookingStatus status;
    /** Hết thời điểm này mà chưa báo thanh toán thì booking hết hạn (BR03). */
    private LocalDateTime holdExpiresAt;
    private BigDecimal finalAmount;

    public static BookingResponse from(Booking booking) {
        return BookingResponse.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus())
                .holdExpiresAt(booking.getHoldExpiresAt())
                .finalAmount(booking.getFinalAmount())
                .build();
    }
}
