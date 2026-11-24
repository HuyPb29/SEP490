package com.sep490.bms.scheduler;

import java.time.LocalDateTime;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.notification.NotificationType;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.service.notification.NotificationService;
import com.sep490.bms.service.payment.PaymentTransferPolicy;

import lombok.RequiredArgsConstructor;

/**
 * D182 (BR58, FR120, P24, P36): giao dịch chờ xác nhận quá 25 phút trong giờ mở cửa (15 phút báo đỏ trên màn Staff,
 * thêm 10 phút) mà Staff chưa xử lý thì chuyển cho
 * chủ sân. Job chỉ gửi thông báo: báo Owner xử lý (MSG119), báo Staff của địa điểm là giao dịch đã được chuyển
 * (MSG118). Việc chặn Staff thao tác nằm ở PaymentTransferPolicy, không phụ thuộc job đã chạy hay chưa.
 * Mỗi người nhận chỉ được báo một lần cho một giao dịch.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class PaymentTransferJob {

    private static final long WAIT_MINUTES = Payment.OWNER_TRANSFER_WAIT.toMinutes();

    private final PaymentRepository payments;
    private final PaymentTransferPolicy policy;
    private final LocationRepository locations;
    private final BookingRepository bookings;
    private final AccountRepository accounts;
    private final NotificationService notifications;

    @Scheduled(cron = "${bms.job.payment-escalation.cron:0 * * * * *}")
    @Transactional
    public void notifyTransferredPayments() {
        notifyTransferredPayments(LocalDateTime.now());
    }

    void notifyTransferredPayments(LocalDateTime now) {
        for (Payment payment : payments.findByStatusAndSubmittedAtBefore(PaymentStatus.AWAITING_CONFIRMATION,
                now.minus(Payment.OWNER_TRANSFER_WAIT))) {
            if (!policy.transferredToOwner(payment, now)) {
                continue;
            }
            var location = locations.findById(payment.getLocationId()).orElse(null);
            if (location == null) {
                continue;
            }
            String label = label(payment);
            notifications.notifyOnce(location.getOwnerId(), NotificationType.PAYMENT_TRANSFERRED_TO_OWNER,
                    "Giao dịch chờ chủ sân xác nhận",
                    "Giao dịch " + label + " tại " + location.getName() + " đã chờ quá " + WAIT_MINUTES
                            + " phút mà nhân viên chưa xác nhận. "
                            + "Vui lòng kiểm tra tiền về và xử lý. (MSG119)",
                    "PAYMENT", payment.getId());
            for (var staff : accounts.findByRoleAndLocationId(Role.STAFF, payment.getLocationId())) {
                if (staff.getStatus() == AccountStatus.ACTIVE) {
                    notifications.notifyOnce(staff.getId(), NotificationType.PAYMENT_TRANSFERRED_TO_OWNER,
                            "Giao dịch đã chuyển cho chủ sân",
                            "Giao dịch " + label + " đã chờ quá " + WAIT_MINUTES
                                    + " phút mà chưa được xác nhận nên đã được chuyển "
                                    + "cho chủ sân xử lý. (MSG118)",
                            "PAYMENT", payment.getId());
                }
            }
        }
    }

    private String label(Payment payment) {
        if (payment.getRescheduleRequestId() != null) {
            return "phụ thu đổi lịch #" + payment.getRescheduleRequestId();
        }
        if (payment.getPackageId() != null) {
            return "đơn/gói #" + payment.getPackageId();
        }
        return bookings.findById(payment.getBookingId()).map(b -> b.getBookingCode()).orElse("#" + payment.getId());
    }
}
