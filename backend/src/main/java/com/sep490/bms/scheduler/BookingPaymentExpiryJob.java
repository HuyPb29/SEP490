package com.sep490.bms.scheduler;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.service.payment.PaymentService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * UC37, BR03, FR125 (D80): booking lẻ đã hết giờ chơi mà giao dịch vẫn chờ Staff (Chờ xác nhận, Chờ bổ sung)
 * thì chuyển Bị từ chối thanh toán, báo Player và Owner (MSG56). Gói làm việc này ở PackageHoldExpiryJob.
 * Không có job này thì booking treo mãi ở trạng thái chờ và vẫn bị tính vào giới hạn booking chờ thanh toán
 * của Player (BR35). Mỗi giao dịch một transaction: một giao dịch lỗi không làm hỏng các giao dịch khác.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "bms.job.enabled", havingValue = "true", matchIfMissing = true)
public class BookingPaymentExpiryJob {

    private static final List<PaymentStatus> WAITING_FOR_STAFF =
            List.of(PaymentStatus.AWAITING_CONFIRMATION, PaymentStatus.RESUBMIT_REQUESTED);

    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;

    @Scheduled(
            initialDelayString = "${bms.job.booking-hold.initial-delay-ms:30000}",
            fixedDelayString = "${bms.job.booking-hold.interval-ms:60000}")
    public void rejectPaymentsPastPlayEnd() {
        LocalDateTime now = LocalDateTime.now();
        int rejected = 0;
        for (Long paymentId : paymentRepository.findBookingPaymentExpiryCandidates(WAITING_FOR_STAFF, now.toLocalDate())) {
            try {
                if (paymentService.expireBookingPayment(paymentId, now)) {
                    rejected++;
                }
            } catch (RuntimeException e) {
                log.error("[UC37] Không từ chối được thanh toán quá giờ chơi {}", paymentId, e);
            }
        }
        if (rejected > 0) {
            log.info("[UC37] Từ chối {} thanh toán booking lẻ đã hết giờ chơi", rejected);
        }
    }
}
