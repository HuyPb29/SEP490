package com.sep490.bms.service.payment;

import java.time.Duration;
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
 * Cảnh báo vận hành từ 10 phút chờ trong giờ mở cửa; hạn khiếu nại P24 vẫn là 15 phút. Màn Staff
 * báo đỏ; Staff vẫn xử lý được. Quá 25 phút (P24 + P36), giao dịch được
 * chuyển cho chủ sân: từ lúc đó Staff không xác nhận, yêu cầu bổ sung hay từ chối được nữa; Owner xử lý.
 * Mốc tính từ lần gửi chứng từ gần nhất, như BR58. Áp cho thanh toán booking lẻ, gói, đơn đặt lẻ
 * và phụ thu đổi lịch.
 */
@Service
@RequiredArgsConstructor
public class PaymentTransferPolicy {

    /** MSG118: Staff thao tác trên giao dịch đã chuyển cho chủ sân. */
    public static final String TRANSFERRED_MESSAGE = "Giao dịch đã chờ quá " + Payment.OWNER_TRANSFER_WAIT.toMinutes()
            + " phút mà chưa được xác nhận nên đã được chuyển cho chủ sân xử lý. (MSG118)";

    private final SlotAvailabilityService availability;

    /** Giao dịch đang chờ xác nhận từ 10 phút trong giờ mở cửa: màn Staff/Owner báo đỏ. */
    public boolean overdue(Payment payment, LocalDateTime now) {
        return waitedLongerThan(payment, now, Payment.CONFIRMATION_ALERT_WAIT.minusNanos(1));
    }

    /** Giao dịch đang chờ xác nhận đã quá 25 phút (P24 + P36) trong giờ mở cửa: thuộc về chủ sân. */
    public boolean transferredToOwner(Payment payment, LocalDateTime now) {
        return waitedLongerThan(payment, now, Payment.OWNER_TRANSFER_WAIT);
    }

    /** Staff không còn xử lý được giao dịch đã chuyển cho chủ sân; Owner luôn xử lý được (BR58). */
    public void requireStaffMayDecide(UserPrincipal user, Payment payment, LocalDateTime now) {
        if (user != null && user.getRole() == Role.STAFF && transferredToOwner(payment, now)) {
            throw new AppException(TRANSFERRED_MESSAGE, HttpStatus.CONFLICT);
        }
    }

    private boolean waitedLongerThan(Payment payment, LocalDateTime now, Duration wait) {
        return payment != null && payment.getStatus() == PaymentStatus.AWAITING_CONFIRMATION
                && availability.exceededOpeningTime(payment.getLocationId(), payment.getSubmittedAt(), now, wait);
    }
}
