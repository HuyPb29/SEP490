package com.sep490.bms.service.payment;

import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.SlotAvailabilityService;

import lombok.RequiredArgsConstructor;

/**
 * D174 (BR58, P24, FR120): giao dịch chờ xác nhận quá 15 phút (chỉ tính trong giờ mở cửa) mà Staff chưa xử lý
 * thì được chuyển cho chủ sân. Từ lúc đó Staff không xác nhận, yêu cầu bổ sung hay từ chối được nữa; Owner xử lý.
 * Mốc 15 phút tính từ lần gửi chứng từ gần nhất, như BR58. Áp cho thanh toán booking lẻ, gói, đơn đặt lẻ
 * và phụ thu đổi lịch.
 */
@Service
@RequiredArgsConstructor
public class PaymentTransferPolicy {

    /** MSG118: Staff thao tác trên giao dịch đã chuyển cho chủ sân. */
    public static final String TRANSFERRED_MESSAGE =
            "Giao dịch đã chờ quá 15 phút mà chưa được xác nhận nên đã được chuyển cho chủ sân xử lý. (MSG118)";

    private final SlotAvailabilityService availability;

    /** Giao dịch đang chờ xác nhận đã quá 15 phút trong giờ mở cửa: thuộc về chủ sân. */
    public boolean transferredToOwner(Payment payment, LocalDateTime now) {
        return payment != null && payment.getStatus() == PaymentStatus.AWAITING_CONFIRMATION
                && availability.exceededOpeningTime(payment.getLocationId(), payment.getSubmittedAt(), now,
                        Payment.LATE_CONFIRMATION_WAIT);
    }

    /** Staff không còn xử lý được giao dịch đã chuyển cho chủ sân; Owner luôn xử lý được (BR58). */
    public void requireStaffMayDecide(UserPrincipal user, Payment payment, LocalDateTime now) {
        if (user != null && user.getRole() == Role.STAFF && transferredToOwner(payment, now)) {
            throw new AppException(TRANSFERRED_MESSAGE, HttpStatus.CONFLICT);
        }
    }
}
