package com.sep490.bms.service.payment;

import java.time.LocalDate;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.payment.ReconciliationSummaryResponse;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.payment.ConfirmedPaymentTotal;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Đối soát doanh thu cuối ngày (UC20, FR61). Staff so tổng tiền các giao dịch đã xác nhận trong ngày
 * với số tiền thực nhận (sao kê ngân hàng và tiền mặt); hệ thống không đọc được ngân hàng (D02),
 * nên số thực nhận do Staff nhập.
 */
@Service
@RequiredArgsConstructor
public class ReconciliationService {

    private final PaymentRepository paymentRepository;
    private final LocationAccessService locationAccessService;

    /**
     * UC20 #1: tổng giao dịch đã xác nhận trong ngày của địa điểm Staff làm việc. Không gửi ngày thì lấy
     * hôm nay. Không thay đổi gì.
     */
    @Transactional(readOnly = true)
    public ReconciliationSummaryResponse getDaySummary(UserPrincipal staff, LocalDate date) {
        return getDaySummary(staff, date, LocalDate.now());
    }

    ReconciliationSummaryResponse getDaySummary(UserPrincipal staff, LocalDate date, LocalDate today) {
        LocalDate day = date == null ? today : date;
        requireNotFuture(day, today);
        Location location = locationAccessService.selectedLocation(staff);
        ConfirmedPaymentTotal total = confirmedTotal(location.getId(), day);

        return ReconciliationSummaryResponse.builder()
                .locationId(location.getId())
                .date(day)
                .confirmedCount(total.count())
                .systemAmount(total.amountDue())
                .overpaidAmount(total.receivedAmount().subtract(total.amountDue()))
                .build();
    }

    private ConfirmedPaymentTotal confirmedTotal(Long locationId, LocalDate day) {
        return paymentRepository.sumByConfirmedAt(locationId, PaymentStatus.CONFIRMED,
                day.atStartOfDay(), day.plusDays(1).atStartOfDay());
    }

    /** Ngày chưa đến thì chưa có gì để đối soát. */
    private static void requireNotFuture(LocalDate day, LocalDate today) {
        if (day.isAfter(today)) {
            throw new AppException("Không đối soát được ngày chưa đến");
        }
    }
}
