package com.sep490.bms.service.location;

import java.time.*;
import java.util.*;
import java.math.BigDecimal;
import com.sep490.bms.dto.location.ServiceRenewalDtos.*;
import com.sep490.bms.entity.account.*;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.*;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.notification.NotificationService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** F2/UC06: Owner xin gia hạn, Admin đối chiếu tiền ngoài hệ thống rồi ghi kỳ hạn. */
@Service @RequiredArgsConstructor
public class ServiceRenewalService {
    private final ServiceRenewalRepository requests;
    private final LocationRepository locations;
    private final CourtRepository courts;
    private final ServiceTermRepository terms;
    private final LocationManagementService management;
    private final AccountRepository accounts;
    private final NotificationService notifications;
    private final FileStorageService files;
    private final EntityManager em;

    public static Quote calculate(int years, int count, LocalDate previousEnd, LocalDate today) {
        if (years < 1 || years > 10) throw new AppException("Số năm gia hạn phải từ 1 đến 10");
        if (count < 1) throw new AppException("Địa điểm chưa có sân để gia hạn");
        LocalDate start = previousEnd != null && !previousEnd.isBefore(today) ? previousEnd.plusDays(1) : today;
        return new Quote(years, count, previousEnd, start, start.plusYears(years).minusDays(1), RentalFeeCalculator.amount(count, years));
    }

    private Quote currentQuote(Long locationId, int years) {
        LocalDate last = terms.findFirstByLocationIdOrderByEndDateDescIdDesc(locationId)
                .map(ServiceTerm::getEndDate).orElse(null);
        return calculate(years, courts.findAllByLocationIdOrderByNameAsc(locationId).size(), last, LocalDate.now());
    }

    @Transactional(readOnly=true)
    public Quote quote(UserPrincipal owner, Long locationId, int years) {
        management.ownedLocation(owner, locationId); // Cho phép gia hạn cả địa điểm đã khóa.
        return currentQuote(locationId, years);
    }

    @Transactional
    public View submit(UserPrincipal owner, Long locationId, Submit data, MultipartFile proof) {
        Location location = lockLocation(locationId);
        management.requireOwnership(owner, location);
        if (!data.termsAccepted()) throw new AppException("Vui lòng đồng ý điều khoản gia hạn");
        Quote quote = currentQuote(locationId, data.rentalYears());
        if (!quote.startDate().equals(data.quotedStart()) || !quote.endDate().equals(data.quotedEnd())
                || quote.amount().compareTo(data.quotedAmount()) != 0) {
            throw new AppException("Báo giá đã thay đổi. Hãy tải lại trước khi chuyển khoản và gửi đơn", HttpStatus.CONFLICT);
        }
        if (requests.existsByLocationIdAndStatus(locationId, ApprovalStatus.PENDING)) {
            throw new AppException("Địa điểm đã có yêu cầu gia hạn chờ duyệt", HttpStatus.CONFLICT);
        }
        if (proof == null || proof.isEmpty()) throw new AppException("Hãy chọn ảnh chứng từ chuyển khoản");
        ServiceRenewal row = requests.save(ServiceRenewal.builder().locationId(locationId).ownerId(owner.getId())
                .rentalYears(quote.rentalYears()).courtCount(quote.courtCount()).previousEnd(quote.previousEnd())
                .quotedStart(quote.startDate()).quotedEnd(quote.endDate()).amount(quote.amount())
                .proofPath(files.storeImage(proof, "service-renewal-proofs"))
                .status(ApprovalStatus.PENDING).createdAt(LocalDateTime.now()).build());
        for (Account admin : accounts.findByRoleAndStatus(Role.ADMIN, AccountStatus.ACTIVE)) {
            notifications.notify(admin.getId(), "SERVICE_RENEWAL_SUBMITTED", "Yêu cầu gia hạn dịch vụ",
                    location.getName() + " đề nghị gia hạn " + data.rentalYears() + " năm. Hãy kiểm tra chứng từ và tiền nhận.",
                    "SERVICE_RENEWAL", row.getId());
        }
        return view(row);
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
        if (admin == null || admin.getRole() != Role.ADMIN) throw new AppException("Chỉ quản trị viên được xét duyệt", HttpStatus.FORBIDDEN);
        var snapshot = requests.findById(id).orElseThrow(() -> new AppException("Không tìm thấy yêu cầu gia hạn", HttpStatus.NOT_FOUND));
        Location location = lockLocation(snapshot.getLocationId());
        ServiceRenewal row = requests.findByIdForUpdate(id).orElseThrow();
        em.refresh(row, LockModeType.PESSIMISTIC_WRITE);
        if (row.getStatus() != ApprovalStatus.PENDING) throw new AppException("Yêu cầu đã được xử lý", HttpStatus.CONFLICT);
        if (approve && !data.paymentConfirmed()) throw new AppException("Hãy xác nhận đã nhận đủ tiền gia hạn");
        if (!Objects.equals(location.getOwnerId(), row.getOwnerId())) throw new AppException("Chủ địa điểm đã thay đổi", HttpStatus.CONFLICT);
        if (!approve && (data.reason() == null || data.reason().isBlank())) throw new AppException("Hãy nhập lý do từ chối");
        if (approve) {
            Quote current = currentQuote(row.getLocationId(), row.getRentalYears());
            if (!Objects.equals(current.previousEnd(), row.getPreviousEnd()) || current.courtCount() != row.getCourtCount()) {
                throw new AppException("Kỳ hạn hoặc số sân đã thay đổi. Hãy từ chối, hoàn tiền và yêu cầu chủ sân nộp lại", HttpStatus.CONFLICT);
            }
            // Còn hạn: nối tiếp hạn xa nhất. Đã hết hạn: từ ngày duyệt, không thu phí khoảng gián đoạn.
            row.setQuotedStart(current.startDate());
            row.setQuotedEnd(current.endDate());
            ServiceTerm term = terms.save(ServiceTerm.builder().locationId(row.getLocationId())
                    .startDate(current.startDate()).endDate(current.endDate()).recordedBy(admin.getId()).build());
            row.setServiceTermId(term.getId());
            location.setStatus("ACTIVE"); // Quyết định duyệt bao gồm mở lại địa điểm.
            location.setLockedAt(null);
            location.setUpdatedAt(LocalDateTime.now());
        }
        row.setStatus(approve ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED);
        row.setRejectReason(approve ? null : data.reason().trim());
        row.setProcessedBy(admin.getId());
        row.setProcessedAt(LocalDateTime.now());
        requests.save(row);
        notifications.notify(row.getOwnerId(), approve ? "SERVICE_RENEWAL_APPROVED" : "SERVICE_RENEWAL_REJECTED",
                approve ? "Gia hạn dịch vụ thành công" : "Yêu cầu gia hạn bị từ chối",
                approve ? location.getName() + ": kỳ hạn " + row.getQuotedStart() + " đến " + row.getQuotedEnd()
                        : row.getRejectReason() + ". Bên vận hành sẽ liên hệ hoàn tiền. Có thể gửi yêu cầu mới.",
                "SERVICE_RENEWAL", row.getId());
        return view(row);
    }

    @Transactional(readOnly=true)
    public Resource proof(UserPrincipal user, Long id) {
        var row = requests.findById(id).orElseThrow(() -> new AppException("Không tìm thấy yêu cầu gia hạn", HttpStatus.NOT_FOUND));
        if (user == null) throw new AppException("Chưa đăng nhập", HttpStatus.UNAUTHORIZED);
        if (user.getRole() != Role.ADMIN) management.ownedLocation(user, row.getLocationId());
        return files.load(row.getProofPath());
    }

    private Location lockLocation(Long id) {
        Location location = locations.findByIdForUpdate(id).orElseThrow(() -> new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));
        em.refresh(location, LockModeType.PESSIMISTIC_WRITE);
        return location;
    }
    private View view(ServiceRenewal row) {
        String name = locations.findById(row.getLocationId()).map(Location::getName).orElse("Địa điểm");
        return new View(row.getId(), row.getLocationId(), name, row.getRentalYears(), row.getCourtCount(),
                row.getQuotedStart(), row.getQuotedEnd(), row.getAmount(), row.getStatus().name(),
                row.getRejectReason(), row.getCreatedAt(), row.getProcessedAt());
    }
}
