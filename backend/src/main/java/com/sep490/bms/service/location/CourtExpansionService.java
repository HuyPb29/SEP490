package com.sep490.bms.service.location;

import java.math.*;
import java.time.*;

import java.util.*;
import com.sep490.bms.dto.location.CourtExpansionDtos.*;
import com.sep490.bms.entity.account.*;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.*;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service @RequiredArgsConstructor
public class CourtExpansionService {
    private final CourtExpansionRepository requests;
    private final LocationRepository locations;
    private final ServiceTermRepository terms;
    private final CourtRepository courts;
    private final LocationManagementService management;
    private final FileStorageService files;
    private final NotificationService notifications;
    private final AccountRepository accounts;
    private final jakarta.persistence.EntityManager em;

    /** Phần lẻ đến 15 ngày thì bỏ, từ 16 ngày thì tính thêm một tháng (D173). */
    static final int HALF_MONTH_DAYS = 15;

    /**
     * Số tháng tính tiền từ ngày gửi đơn đến ngày hết hạn sử dụng dịch vụ (tính cả ngày cuối), D173:
     * đếm tháng tròn, phần lẻ 1–15 ngày làm tròn xuống, 16 ngày trở lên làm tròn lên.
     */
    public static int chargeableMonths(LocalDate start, LocalDate end) {
        if (end.isBefore(start)) return 0;
        Period period = Period.between(start, end.plusDays(1));
        int months = period.getYears() * 12 + period.getMonths();
        return period.getDays() > HALF_MONTH_DAYS ? months + 1 : months;
    }

    /**
     * Tiền mua thêm sân (D173, P35): 1 sân 1 tháng = P35 ÷ 9 sân ÷ 12 tháng; nhân số sân và số tháng tính tiền,
     * làm tròn tổng lên nghìn đồng. Còn dưới nửa tháng thì không mua thêm được, phải gia hạn trước.
     */
    public static Quote calculate(int count, LocalDate start, LocalDate end, BigDecimal referenceFee) {
        if (count < 1 || count > 100) throw new AppException("Số sân thêm phải từ 1 đến 100");
        int months = chargeableMonths(start, end);
        if (months < 1) {
            throw new AppException("Thời hạn sử dụng dịch vụ còn không quá nửa tháng nên không mua thêm sân được. Vui lòng gia hạn trước");
        }
        BigDecimal thousands = referenceFee.multiply(BigDecimal.valueOf(count)).multiply(BigDecimal.valueOf(months))
                .divide(BigDecimal.valueOf(RentalFeeCalculator.REFERENCE_COURTS * 12L * 1000L), 0, RoundingMode.CEILING);
        return new Quote(count, start, end, months, thousands.multiply(BigDecimal.valueOf(1000)), referenceFee);
    }

    @Transactional(readOnly=true)
    public Quote quote(UserPrincipal owner, Long locationId, int count) {
        management.ownedLocation(owner, locationId);
        return currentQuote(locationId, count, LocalDate.now());
    }

    private Quote currentQuote(Long locationId, int count, LocalDate today) {
        Location location = locations.findById(locationId).orElseThrow(() -> new AppException("Không tìm thấy địa điểm"));
        requireActive(location);
        ServiceTerm term = terms.findAllByLocationId(locationId).stream()
                .filter(t -> !t.getStartDate().isAfter(today) && !t.getEndDate().isBefore(today))
                .max(Comparator.comparing(ServiceTerm::getEndDate))
                .orElseThrow(() -> new AppException("Cần hợp đồng còn hiệu lực để đăng ký thêm sân"));
        // Số tháng đếm từ ngày gửi đơn; số tiền chốt lúc gửi, Admin duyệt muộn không tính lại (D173).
        return calculate(count, today, term.getEndDate(), BigDecimal.valueOf(RentalFeeCalculator.REFERENCE_FEE));
    }

    @Transactional
    public View submit(UserPrincipal owner, Long locationId, Submit data, MultipartFile proof) {
        Location location = locations.findByIdForUpdate(locationId).orElseThrow(() -> new AppException("Không tìm thấy địa điểm"));
        em.refresh(location, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        management.requireOwnership(owner, location);
        Quote quote = currentQuote(locationId, data.courtCount(), LocalDate.now());
        if (!quote.startDate().equals(data.quotedStart()) || !quote.endDate().equals(data.contractEnd())
                || quote.amount().compareTo(data.quotedAmount()) != 0) {
            throw new AppException("Báo giá đã thay đổi. Hãy tải lại báo giá trước khi gửi đơn", HttpStatus.CONFLICT);
        }
        if (requests.existsByLocationIdAndStatus(locationId, ApprovalStatus.PENDING)) {
            throw new AppException("Địa điểm đã có yêu cầu thêm sân chờ duyệt", HttpStatus.CONFLICT);
        }
        CourtExpansion request = requests.save(CourtExpansion.builder().locationId(locationId).ownerId(owner.getId())
                .courtCount(data.courtCount()).referenceFee(quote.referenceFee()).quotedStart(quote.startDate())
                .contractEnd(quote.endDate()).quotedAmount(quote.amount())
                .proofPath(files.storeImage(proof, "court-expansion-proofs"))
                .status(ApprovalStatus.PENDING).createdAt(LocalDateTime.now()).build());
        for (Account admin : accounts.findByRoleAndStatus(Role.ADMIN, AccountStatus.ACTIVE)) {
            notifications.notify(admin.getId(), "COURT_EXPANSION_SUBMITTED", "Yêu cầu thêm sân",
                    location.getName() + " đăng ký thêm " + data.courtCount() + " sân. Vui lòng kiểm tra trong ngày.",
                    "LOCATION", locationId);
        }
        return view(request);
    }

    @Transactional(readOnly=true)
    public List<View> ownerList(UserPrincipal owner, Long locationId) {
        management.ownedLocation(owner, locationId);
        return requests.findAllByLocationIdOrderByCreatedAtDescIdDesc(locationId).stream().map(this::view).toList();
    }

    @Transactional(readOnly=true)
    public List<View> adminList() {
        return requests.findAllByOrderByCreatedAtDescIdDesc().stream().map(this::view).toList();
    }

    @Transactional
    public View decide(UserPrincipal admin, Long id, Decision data, boolean approve) {
        if (admin == null || admin.getRole() != Role.ADMIN) throw new AppException("Chỉ Admin được xét duyệt", HttpStatus.FORBIDDEN);
        // Khóa địa điểm trước rồi đến đơn, cùng thứ tự với gửi đơn/đổi cấu hình sân.
        CourtExpansion snapshot = requests.findById(id).orElseThrow(() -> new AppException("Không tìm thấy đơn"));
        Location location = locations.findByIdForUpdate(snapshot.getLocationId()).orElseThrow(() -> new AppException("Không tìm thấy địa điểm"));
        em.refresh(location, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        CourtExpansion request = requests.findByIdForUpdate(id).orElseThrow();
        em.refresh(request, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if (request.getStatus() != ApprovalStatus.PENDING) throw new AppException("Đơn đã được xử lý", HttpStatus.CONFLICT);
        LocalDateTime now = LocalDateTime.now();
        BigDecimal amount = BigDecimal.ZERO;
        if (approve) {
            requireActive(location);
            if (!Objects.equals(location.getOwnerId(), request.getOwnerId())) throw new AppException("Chủ địa điểm đã thay đổi");
            // Số tiền đã chốt lúc chủ sân gửi đơn (D173); sân nhận lịch từ ngày sau khi duyệt.
            LocalDate effectiveStart = now.toLocalDate().plusDays(1);
            if (effectiveStart.isAfter(request.getContractEnd())) {
                throw new AppException("Thời hạn sử dụng dịch vụ đã hết nên không duyệt được. Hãy từ chối và hoàn tiền cho chủ sân",
                        HttpStatus.CONFLICT);
            }
            amount = request.getQuotedAmount();
            request.setEffectiveStart(effectiveStart);
        } else if (data.reason() == null || data.reason().isBlank()) {
            throw new AppException("Vui lòng nhập lý do từ chối");
        }
        verifySettlement(amount, data);
        request.setFinalAmount(amount);
        request.setReceivedAmount(data.receivedAmount());
        request.setRefundedAmount(data.refundedAmount());
        request.setSettlementNote(data.settlementNote());
        request.setRejectReason(approve ? null : data.reason().trim());
        request.setStatus(approve ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED);
        request.setProcessedAt(now);
        request.setProcessedBy(admin.getId());
        if (approve) createCourts(request, now);
        requests.save(request);
        notifications.notify(request.getOwnerId(), approve ? "COURT_EXPANSION_APPROVED" : "COURT_EXPANSION_REJECTED",
                approve ? "Đã duyệt thêm sân" : "Yêu cầu thêm sân bị từ chối",
                approve ? "Đã tạo " + request.getCourtCount() + " sân tại " + location.getName() + ". Hiệu lực từ "
                    + request.getEffectiveStart() + " đến " + request.getContractEnd() + ". Phí " + amount
                    + "đ; đã hoàn " + data.refundedAmount() + "đ. Hãy cấu hình giá và bật sân."
                    : data.reason().substring(0, Math.min(400, data.reason().length())) + ". Đã hoàn " + data.refundedAmount() + "đ.", "LOCATION", location.getId());
        return view(request);
    }

    static void verifySettlement(BigDecimal amount, Decision data) {
        if (data.receivedAmount() == null || data.refundedAmount() == null
                || data.receivedAmount().signum() < 0 || data.refundedAmount().signum() < 0) throw new AppException("Số tiền không hợp lệ");
        BigDecimal difference = data.receivedAmount().subtract(amount);
        if (difference.signum() < 0) throw new AppException("Chưa nhận đủ tiền. Cần thu bổ sung trước khi duyệt");
        if (difference.compareTo(data.refundedAmount()) != 0) throw new AppException("Phải ghi nhận hoàn đúng phần tiền thừa: " + difference + "đ");
        if (difference.signum() > 0 && (data.settlementNote() == null || data.settlementNote().isBlank())) {
            throw new AppException("Vui lòng ghi thời gian và mã giao dịch hoàn tiền đã thực hiện");
        }
    }

    private void createCourts(CourtExpansion request, LocalDateTime now) {
        Set<String> names = new HashSet<>();
        courts.findAllByLocationIdOrderByNameAsc(request.getLocationId()).forEach(c -> names.add(c.getName().toLowerCase(Locale.ROOT)));
        int index = 1;
        for (int n = 0; n < request.getCourtCount(); n++) {
            while (names.contains(("Sân " + index).toLowerCase(Locale.ROOT))
                    || courts.findByLocationIdAndNameIgnoreCase(request.getLocationId(), "Sân " + index).isPresent()) index++;
            String name = "Sân " + index++;
            names.add(name.toLowerCase(Locale.ROOT));
            courts.save(Court.builder().locationId(request.getLocationId()).name(name).active(false)
                    .availableFrom(request.getEffectiveStart()).availableUntil(request.getContractEnd()).createdAt(now).build());
        }
    }

    @Transactional(readOnly=true)
    public Resource proof(UserPrincipal user, Long id) {
        CourtExpansion request = requests.findById(id).orElseThrow(() -> new AppException("Không tìm thấy đơn"));
        if (user.getRole() != Role.ADMIN) management.ownedLocation(user, request.getLocationId());
        return files.load(request.getProofPath());
    }

    private View view(CourtExpansion r) {
        // Đơn chờ duyệt: Admin thấy đúng số tiền đã chốt lúc gửi (không tính lại theo ngày duyệt).
        Quote quote = r.getStatus() == ApprovalStatus.PENDING
                ? new Quote(r.getCourtCount(), r.getQuotedStart(), r.getContractEnd(),
                        chargeableMonths(r.getQuotedStart(), r.getContractEnd()), r.getQuotedAmount(), r.getReferenceFee())
                : null;
        return new View(r.getId(), r.getLocationId(), locations.findById(r.getLocationId()).map(Location::getName).orElse(""),
                r.getCourtCount(), r.getStatus().name(), r.getQuotedStart(), r.getContractEnd(), r.getQuotedAmount(),
                r.getEffectiveStart(), r.getFinalAmount(), r.getReceivedAmount(), r.getRefundedAmount(),
                r.getSettlementNote(), r.getRejectReason(), r.getCreatedAt(), r.getProcessedAt(), quote);
    }

    private void requireActive(Location location) {
        if (!"ACTIVE".equals(location.getStatus())) throw new AppException("Địa điểm đang bị khóa", HttpStatus.FORBIDDEN);
    }
}
