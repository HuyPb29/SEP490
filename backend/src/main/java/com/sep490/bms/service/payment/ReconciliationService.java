package com.sep490.bms.service.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.payment.ReconciliationRequest;
import com.sep490.bms.dto.payment.ReconciliationResponse;
import com.sep490.bms.dto.payment.ReconciliationSummaryResponse;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.payment.Reconciliation;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.payment.ConfirmedPaymentTotal;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.repository.payment.ReconciliationRepository;
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

    /** Unique (location_id, recon_date): mỗi địa điểm đối soát mỗi ngày một lần. */
    static final String RECON_DAY_UNIQUE_INDEX = "ux_recon_day";
    private static final DateTimeFormatter DAY_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final int MAX_PAGE_SIZE = 100;

    private final PaymentRepository paymentRepository;
    private final ReconciliationRepository reconciliationRepository;
    private final AccountRepository accountRepository;
    private final LocationAccessService locationAccessService;

    /**
     * UC20 #1: tổng giao dịch đã xác nhận trong ngày của địa điểm Staff làm việc, kèm kết quả đã lưu nếu
     * ngày đó đã đối soát. Không gửi ngày thì lấy hôm nay. Không thay đổi gì.
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
                .reconciliation(reconciliationRepository.findByLocationIdAndReconDate(location.getId(), day)
                        .map(this::toResponse)
                        .orElse(null))
                .build();
    }

    /**
     * UC20 #2–#4, FR61: lưu kết quả đối soát của một ngày (MSG60). Số hệ thống tính lại lúc lưu, không lấy
     * từ màn hình. Lệch mà chưa có lý do thì báo MSG59. Mỗi ngày chỉ lưu một lần, không sửa (DR16):
     * ngày đã đối soát thì 409, kể cả khi hai Staff cùng bấm (unique ux_recon_day).
     */
    @Transactional
    public ReconciliationResponse submit(UserPrincipal staff, ReconciliationRequest request) {
        return submit(staff, request, LocalDate.now());
    }

    ReconciliationResponse submit(UserPrincipal staff, ReconciliationRequest request, LocalDate today) {
        LocalDate day = request.date();
        requireNotFuture(day, today);
        Location location = locationAccessService.selectedLocation(staff);
        if (reconciliationRepository.existsByLocationIdAndReconDate(location.getId(), day)) {
            throw alreadyReconciled(day);
        }

        BigDecimal systemAmount = confirmedTotal(location.getId(), day).amountDue();
        BigDecimal difference = request.actualAmount().subtract(systemAmount);
        String reason = trimToNull(request.reason());
        if (difference.signum() != 0 && reason == null) {
            throw new AppException("Số tiền lệch " + signedMoney(difference) + ". Vui lòng nhập lý do. (MSG59)");
        }

        Reconciliation saved;
        try {
            saved = reconciliationRepository.saveAndFlush(Reconciliation.builder()
                    .locationId(location.getId())
                    .reconDate(day)
                    .systemAmount(systemAmount)
                    .actualAmount(request.actualAmount())
                    .reason(reason)
                    .staffId(staff.getId())
                    .build());
        } catch (DataIntegrityViolationException e) {
            String cause = e.getMostSpecificCause().getMessage();
            if (cause == null || !cause.contains(RECON_DAY_UNIQUE_INDEX)) {
                throw e;
            }
            throw alreadyReconciled(day);
        }
        return toResponse(saved);
    }

    /** UC20 #4: xem lại một kết quả đối soát của địa điểm. Kết quả của địa điểm khác trả 403 (NFR07). */
    @Transactional(readOnly = true)
    public ReconciliationResponse getById(UserPrincipal user, Long id) {
        Location location = locationAccessService.selectedLocation(user);
        Reconciliation reconciliation = reconciliationRepository.findById(id)
                .orElseThrow(() -> new AppException("Không tìm thấy kết quả đối soát", HttpStatus.NOT_FOUND));
        if (!location.getId().equals(reconciliation.getLocationId())) {
            throw new AppException("Kết quả đối soát không thuộc địa điểm của bạn", HttpStatus.FORBIDDEN);
        }
        return toResponse(reconciliation);
    }

    /**
     * UC20 #5, FR61: Owner xem kết quả đối soát của địa điểm đang chọn (X-Location-Id), ngày mới nhất lên đầu,
     * lọc theo khoảng ngày nếu có. Không thay đổi gì.
     */
    @Transactional(readOnly = true)
    public PageResponse<ReconciliationResponse> listForOwner(UserPrincipal owner, LocalDate from, LocalDate to,
            int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new AppException("Phân trang không hợp lệ");
        }
        if (from != null && to != null && from.isAfter(to)) {
            throw new AppException("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
        }
        Location location = locationAccessService.selectedLocation(owner);
        Page<Reconciliation> result = reconciliationRepository.findForLocation(location.getId(), from, to,
                PageRequest.of(page, size));
        Map<Long, String> staffNames = staffNames(result.map(Reconciliation::getStaffId).toSet());
        return PageResponse.from(result.map(item -> ReconciliationResponse.from(item, staffNames.get(item.getStaffId()))));
    }

    private ConfirmedPaymentTotal confirmedTotal(Long locationId, LocalDate day) {
        return paymentRepository.sumByConfirmedAt(locationId, PaymentStatus.CONFIRMED,
                day.atStartOfDay(), day.plusDays(1).atStartOfDay());
    }

    private ReconciliationResponse toResponse(Reconciliation reconciliation) {
        String staffName = accountRepository.findById(reconciliation.getStaffId())
                .map(Account::getFullName)
                .orElse(null);
        return ReconciliationResponse.from(reconciliation, staffName);
    }

    /** Tên Staff đã đối soát, đọc một lần cho cả trang. */
    private Map<Long, String> staffNames(Collection<Long> staffIds) {
        Map<Long, String> names = new HashMap<>();
        accountRepository.findAllById(staffIds).forEach(account -> names.put(account.getId(), account.getFullName()));
        return names;
    }

    /** Ngày chưa đến thì chưa có gì để đối soát. */
    private static void requireNotFuture(LocalDate day, LocalDate today) {
        if (day.isAfter(today)) {
            throw new AppException("Không đối soát được ngày chưa đến");
        }
    }

    private static AppException alreadyReconciled(LocalDate day) {
        return new AppException("Ngày " + DAY_FORMAT.format(day) + " đã được đối soát.", HttpStatus.CONFLICT);
    }

    private static String trimToNull(String text) {
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** 50000 → "+50.000 đồng", -20000 → "-20.000 đồng". */
    private static String signedMoney(BigDecimal amount) {
        return String.format(Locale.forLanguageTag("vi-VN"), "%+,d đồng", amount.longValueExact());
    }
}
