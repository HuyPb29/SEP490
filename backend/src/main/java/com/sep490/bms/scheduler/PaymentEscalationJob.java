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
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.notification.NotificationRepository;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.service.notification.NotificationService;
import com.sep490.bms.service.payment.PaymentEscalation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * UC37 #7, FR120, BR58 (D174): giao dịch chờ xác nhận quá X phút (P24, trong giờ mở cửa) mà Staff chưa xử lý thì
 * chuyển cho chủ sân: báo Owner (MSG119) và Staff của địa điểm (MSG118). Mỗi giao dịch chỉ báo một lần cho mỗi người.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class PaymentEscalationJob {

    /** Phụ thu đổi lịch có màn xác nhận riêng nên dùng ref_type khác để thông báo mở đúng màn. */
    static String refType(Payment payment) {
        return payment.getRescheduleRequestId() != null ? "RESCHEDULE_PAYMENT" : "PAYMENT";
    }

    private final PaymentRepository payments;
    private final LocationRepository locations;
    private final AccountRepository accounts;
    private final NotificationRepository notificationRepository;
    private final NotificationService notifications;
    private final PaymentEscalation escalation;

    @Scheduled(cron = "${bms.job.payment-escalation.cron:0 * * * * *}")
    @Transactional
    public void escalateOverduePayments() {
        escalateOverduePayments(LocalDateTime.now());
    }

    void escalateOverduePayments(LocalDateTime now) {
        int escalated = 0;
        for (Payment payment : payments.findByStatusAndSubmittedAtBefore(PaymentStatus.AWAITING_CONFIRMATION,
                now.minus(Payment.LATE_CONFIRMATION_WAIT))) {
            var location = locations.findById(payment.getLocationId()).orElse(null);
            if (location == null || location.getOwnerId() == null
                    || alreadyNotified(location.getOwnerId(), payment)
                    || !escalation.escalated(payment, now)) {
                continue;
            }
            String label = escalation.label(payment);
            notifications.notifyOnce(location.getOwnerId(), NotificationType.PAYMENT_ESCALATED_TO_OWNER,
                    "Giao dịch chờ xác nhận đã chuyển cho bạn", PaymentEscalation.ownerMessage(label, location.getName()),
                    refType(payment), payment.getId());
            for (var staff : accounts.findByRoleAndLocationId(Role.STAFF, payment.getLocationId())) {
                if (staff.getStatus() == AccountStatus.ACTIVE) {
                    notifications.notifyOnce(staff.getId(), NotificationType.PAYMENT_ESCALATED,
                            "Giao dịch đã chuyển cho chủ sân", PaymentEscalation.staffMessage(label),
                            refType(payment), payment.getId());
                }
            }
            escalated++;
        }
        if (escalated > 0) {
            log.info("[UC37] Chuyển {} giao dịch chờ xác nhận quá P24 cho chủ sân", escalated);
        }
    }

    /** Đã báo Owner thì bỏ qua, khỏi tính lại giờ mở cửa mỗi phút. */
    private boolean alreadyNotified(Long ownerId, Payment payment) {
        return notificationRepository.existsByRecipientIdAndTypeAndRefTypeAndRefId(ownerId,
                NotificationType.PAYMENT_ESCALATED_TO_OWNER, refType(payment), payment.getId());
    }
}
