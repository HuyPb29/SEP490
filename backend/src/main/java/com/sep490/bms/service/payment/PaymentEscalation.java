package com.sep490.bms.service.payment;

import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.SlotAvailabilityService;

import lombok.RequiredArgsConstructor;

/**
 * FR120, BR58 (D174): giao dịch chờ xác nhận quá X phút (P24, chỉ tính trong giờ mở cửa, từ lần gửi chứng từ gần
 * nhất) mà Staff chưa xử lý thì được chuyển cho chủ sân. Từ lúc đó chỉ Owner xác nhận, yêu cầu bổ sung hoặc từ chối;
 * Staff chỉ xem. Trạng thái tính theo thời gian nên bảng điều hành, màn xác nhận thanh toán và job thông báo dùng
 * chung một quy tắc.
 */
@Component
@RequiredArgsConstructor
public class PaymentEscalation {

    private final SlotAvailabilityService availability;
    private final BookingRepository bookings;

    /** Giao dịch đang chờ xác nhận và đã quá P24 trong giờ mở cửa, tức đã chuyển cho chủ sân. */
    @Transactional(readOnly = true)
    public boolean escalated(Payment payment, LocalDateTime now) {
        return payment.getStatus() == PaymentStatus.AWAITING_CONFIRMATION
                && availability.exceededOpeningTime(payment.getLocationId(), payment.getSubmittedAt(), now,
                        Payment.LATE_CONFIRMATION_WAIT);
    }

    /** BR58: Staff không xử lý giao dịch đã chuyển cho chủ sân; báo lại MSG118. Owner luôn xử lý được. */
    @Transactional(readOnly = true)
    public void requireStaffMayDecide(UserPrincipal user, Payment payment, LocalDateTime now) {
        if (user.getRole() == Role.STAFF && escalated(payment, now)) {
            throw new AppException(staffMessage(label(payment)), HttpStatus.CONFLICT);
        }
    }

    /** Mã giao dịch hiện trong MSG118, MSG119: mã booking, gói/đơn hoặc phụ thu đổi lịch. */
    @Transactional(readOnly = true)
    public String label(Payment payment) {
        if (payment.getRescheduleRequestId() != null) {
            return "phụ thu đổi lịch #" + payment.getRescheduleRequestId();
        }
        if (payment.getPackageId() != null) {
            return "Đơn/Gói #" + payment.getPackageId();
        }
        return payment.getBookingId() == null ? "#" + payment.getId()
                : bookings.findById(payment.getBookingId()).map(b -> b.getBookingCode()).orElse("#" + payment.getId());
    }

    /** MSG118: gửi Staff của địa điểm; cũng hiện khi Staff thao tác trên giao dịch đó. */
    public static String staffMessage(String label) {
        return "Giao dịch " + label + " đã chờ quá " + waitMinutes()
                + " phút mà chưa được xác nhận nên đã được chuyển cho chủ sân xử lý.";
    }

    /** MSG119: gửi Owner. */
    public static String ownerMessage(String label, String locationName) {
        return "Giao dịch " + label + " tại " + locationName + " đã chờ quá " + waitMinutes()
                + " phút mà nhân viên chưa xác nhận. Vui lòng kiểm tra tiền về và xử lý.";
    }

    private static long waitMinutes() {
        return Payment.LATE_CONFIRMATION_WAIT.toMinutes();
    }
}
