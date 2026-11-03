package com.sep490.bms.service.payment;

import java.time.LocalDateTime;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.payment.PaymentInstructionResponse;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.BookingService;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.location.LocationQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Thanh toán booking lẻ (UC18). Hệ thống không nối ngân hàng: Player tự chuyển khoản theo thông tin
 * của địa điểm rồi báo kèm ảnh chứng từ; Staff đối chiếu tiền thực về (BR33, UC19).
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final BookingService bookingService;
    private final LocationQueryService locationQueryService;
    private final FileStorageService fileStorageService;

    /** UC18 #1, FR55: số tiền, tài khoản nhận, mã QR và giờ hết giữ chỗ. Không thay đổi gì. */
    @Transactional(readOnly = true)
    public PaymentInstructionResponse getInstructions(UserPrincipal player, Long bookingId) {
        return getInstructions(player, bookingId, LocalDateTime.now());
    }

    PaymentInstructionResponse getInstructions(UserPrincipal player, Long bookingId, LocalDateTime now) {
        Booking booking = bookingService.getForPlayer(bookingId, player.getId());
        requireWaitingForTransfer(booking, now);
        Location location = locationQueryService.findActive(booking.getLocationId());
        boolean holding = booking.getStatus() == BookingStatus.HOLDING;

        return PaymentInstructionResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus())
                .amountDue(booking.getFinalAmount())
                .bankName(location.getBankName())
                .bankAccountNo(location.getBankAccountNo())
                .bankAccountHolder(location.getBankAccountHolder())
                .qrImageUrl(location.getQrImagePath() == null ? null
                        : "/api/bookings/" + booking.getId() + "/payment-instructions/qr")
                .holdExpiresAt(holding ? booking.getHoldExpiresAt() : null)
                .build();
    }

    /**
     * UC18 #1, FR55: ảnh mã QR của địa điểm, để hiện và để Player lưu về máy.
     * Ảnh không nằm ở thư mục công khai; chỉ người đặt booking đang chờ chuyển khoản mới lấy được (A03).
     */
    @Transactional(readOnly = true)
    public Resource loadQrImage(UserPrincipal player, Long bookingId) {
        return loadQrImage(player, bookingId, LocalDateTime.now());
    }

    Resource loadQrImage(UserPrincipal player, Long bookingId, LocalDateTime now) {
        Booking booking = bookingService.getForPlayer(bookingId, player.getId());
        requireWaitingForTransfer(booking, now);
        String path = locationQueryService.findActive(booking.getLocationId()).getQrImagePath();
        if (path == null) {
            throw new AppException("Địa điểm chưa có ảnh mã QR", HttpStatus.NOT_FOUND);
        }
        return fileStorageService.load(path);
    }

    /**
     * Chỉ booking lẻ đang chờ Player chuyển khoản mới xem được thông tin thanh toán:
     * đang giữ chỗ và còn hạn (lần đầu), hoặc chờ bổ sung (chuyển thêm, gửi lại chứng từ).
     * Buổi trong gói thanh toán theo gói (UC15), không thanh toán riêng.
     */
    private static void requireWaitingForTransfer(Booking booking, LocalDateTime now) {
        if (booking.getPackageId() == null) {
            if (booking.getStatus() == BookingStatus.RESUBMIT_REQUESTED) {
                return;
            }
            if (booking.getStatus() == BookingStatus.HOLDING) {
                requireHoldNotExpired(booking, now);
                return;
            }
        }
        throw notWaitingForPayment();
    }

    /** Đang giữ chỗ nhưng đã quá 5 phút: coi như hết hạn dù job UC37 chưa kịp đổi trạng thái (BR03). */
    private static void requireHoldNotExpired(Booking booking, LocalDateTime now) {
        if (!booking.getHoldExpiresAt().isAfter(now)) {
            throw new AppException("Đã hết thời gian giữ chỗ. Slot đã được nhả. (MSG33)", HttpStatus.CONFLICT);
        }
    }

    private static AppException notWaitingForPayment() {
        return new AppException("Booking này không ở bước thanh toán.", HttpStatus.CONFLICT);
    }
}
