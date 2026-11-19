package com.sep490.bms.service.location;

import java.math.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
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

    /** P35 chưa làm tròn theo sân; quy đổi 365 ngày, rồi làm tròn tổng lên nghìn. */
    public static Quote calculate(int count, LocalDate start, LocalDate end, BigDecimal referenceFee) {
        if (count < 1 || count > 100) throw new AppException("Số sân thêm phải từ 1 đến 100");
        long days = ChronoUnit.DAYS.between(start, end) + 1;
        if (days <= 0) throw new AppException("Hợp đồng không còn ngày sử dụng từ ngày mai");
        BigDecimal thousands = referenceFee.multiply(BigDecimal.valueOf(count)).multiply(BigDecimal.valueOf(days))
                .divide(BigDecimal.valueOf(RentalFeeCalculator.REFERENCE_COURTS * 365L * 1000L), 0, RoundingMode.CEILING);
        return new Quote(count, start, end, days, thousands.multiply(BigDecimal.valueOf(1000)), referenceFee);
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
        return calculate(count, today.plusDays(1), term.getEndDate(), BigDecimal.valueOf(RentalFeeCalculator.REFERENCE_FEE));
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
            Quote quote = calculate(request.getCourtCount(), now.toLocalDate().plusDays(1), request.getContractEnd(), request.getReferenceFee());
            // Admin xác nhận đúng báo giá vừa xem; chặn màn hình cũ hoặc qua nửa đêm.
            if (!quote.startDate().equals(data.effectiveStart()) || data.finalAmount() == null
                    || quote.amount().compareTo(data.finalAmount()) != 0) {
                throw new AppException("Phí hoặc ngày hiệu lực đã thay đổi. Hãy tải lại đơn trước khi duyệt", HttpStatus.CONFLICT);
            }
            amount = quote.amount();
            request.setEffectiveStart(quote.startDate());
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
        Quote quote = r.getStatus() == ApprovalStatus.PENDING && !LocalDate.now().plusDays(1).isAfter(r.getContractEnd())
                ? calculate(r.getCourtCount(), LocalDate.now().plusDays(1), r.getContractEnd(), r.getReferenceFee()) : null;
        return new View(r.getId(), r.getLocationId(), locations.findById(r.getLocationId()).map(Location::getName).orElse(""),
                r.getCourtCount(), r.getStatus().name(), r.getQuotedStart(), r.getContractEnd(), r.getQuotedAmount(),
                r.getEffectiveStart(), r.getFinalAmount(), r.getReceivedAmount(), r.getRefundedAmount(),
                r.getSettlementNote(), r.getRejectReason(), r.getCreatedAt(), r.getProcessedAt(), quote);
    }

    private void requireActive(Location location) {
        if (!"ACTIVE".equals(location.getStatus())) throw new AppException("Địa điểm đang bị khóa", HttpStatus.FORBIDDEN);
    }
}
