package com.sep490.bms.service.feedback;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.feedback.ComplaintResponse;
import com.sep490.bms.dto.feedback.CreateComplaintRequest;
import com.sep490.bms.dto.feedback.ForwardComplaintRequest;
import com.sep490.bms.dto.feedback.RejectComplaintRequest;
import com.sep490.bms.dto.feedback.ResolveComplaintRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.ComplaintResult;
import com.sep490.bms.entity.enums.ComplaintStatus;
import com.sep490.bms.entity.enums.PointTransactionType;
import com.sep490.bms.entity.feedback.Complaint;
import com.sep490.bms.entity.notification.Notification;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.promotion.PlayerLocationBalance;
import com.sep490.bms.entity.promotion.PointTransaction;
import com.sep490.bms.entity.reschedule.RefundRequest;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.feedback.ComplaintRepository;
import com.sep490.bms.repository.notification.NotificationRepository;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.repository.promotion.PlayerLocationBalanceRepository;
import com.sep490.bms.repository.promotion.PointTransactionRepository;
import com.sep490.bms.repository.reschedule.RefundRequestRepository;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * F8 – UC33 Gửi và xử lý khiếu nại.
 * Luồng: Player gửi (SUBMITTED) → Staff ghi chú và chuyển (PENDING_OWNER) → Owner xử lý (RESOLVED/REJECTED).
 * Khiếu nại LATE_PAYMENT_CONFIRMATION (BR49) do Staff tạo và vào thẳng PENDING_OWNER.
 */
@Service
@RequiredArgsConstructor
public class ComplaintService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final Set<String> PLAYER_TYPES = Set.of("SERVICE", "PAYMENT", "FACILITY", "OTHER");

    private final ComplaintRepository complaintRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final LocationRepository locationRepository;
    private final AccountRepository accountRepository;
    private final RefundRequestRepository refundRequestRepository;
    private final PlayerLocationBalanceRepository balanceRepository;
    private final PointTransactionRepository pointTransactionRepository;
    private final NotificationRepository notificationRepository;

    // ---------------------------------------------------------------- Gửi khiếu nại

    @Transactional
    public ComplaintResponse createComplaint(UserPrincipal user, CreateComplaintRequest request) {
        String type = request.getComplaintType().trim().toUpperCase();
        Complaint complaint = user.getRole() == Role.STAFF
                ? buildLatePaymentComplaint(user, type, request)
                : buildPlayerComplaint(user, type, request);
        complaint = complaintRepository.save(complaint);

        if (complaint.getStatus() == ComplaintStatus.SUBMITTED) {
            String title = "Có khiếu nại mới từ người chơi";
            for (Account staff : accountRepository.findByRoleAndLocationId(Role.STAFF, complaint.getLocationId())) {
                notify(staff.getId(), "COMPLAINT_SUBMITTED", title, truncate(complaint.getContent(), 500), complaint);
            }
        } else {
            notifyOwner(complaint, "Khiếu nại xác nhận thanh toán trễ cần duyệt");
        }
        return toResponses(List.of(complaint)).get(0);
    }

    private Complaint buildPlayerComplaint(UserPrincipal user, String type, CreateComplaintRequest request) {
        if (!PLAYER_TYPES.contains(type)) {
            throw new AppException("Loại khiếu nại không hợp lệ, chọn một trong " + PLAYER_TYPES);
        }
        if (request.getBookingId() == null) {
            throw new AppException("Khiếu nại phải gắn với một booking");
        }
        Booking booking = findBooking(request.getBookingId());
        if (!user.getId().equals(booking.getPlayerId())) {
            throw new AppException("Bạn chỉ được khiếu nại booking của chính mình", HttpStatus.FORBIDDEN);
        }
        if (request.getPaymentId() != null) {
            Payment payment = findPayment(request.getPaymentId());
            if (!booking.getId().equals(payment.getBookingId())) {
                throw new AppException("Khoản thanh toán không thuộc booking này");
            }
        }
        return Complaint.builder()
                .locationId(booking.getLocationId())
                .bookingId(booking.getId())
                .paymentId(request.getPaymentId())
                .playerId(user.getId())
                .createdBy(user.getId())
                .complaintType(type)
                .content(request.getContent().trim())
                .build();
    }

    private Complaint buildLatePaymentComplaint(UserPrincipal user, String type, CreateComplaintRequest request) {
        if (!Complaint.TYPE_LATE_PAYMENT_CONFIRMATION.equals(type)) {
            throw new AppException("Nhân viên chỉ được tạo khiếu nại xác nhận thanh toán trễ");
        }
        if (request.getPaymentId() == null) {
            throw new AppException("Khiếu nại xác nhận thanh toán trễ phải gắn với khoản thanh toán");
        }
        Payment payment = findPayment(request.getPaymentId());
        if (!payment.getLocationId().equals(user.getLocationId())) {
            throw new AppException("Khoản thanh toán không thuộc địa điểm của bạn", HttpStatus.FORBIDDEN);
        }
        if (complaintRepository.existsByPaymentIdAndComplaintType(payment.getId(), type)) {
            throw new AppException("Khoản thanh toán này đã có khiếu nại xác nhận trễ", HttpStatus.CONFLICT);
        }
        Long playerId = payment.getBookingId() == null ? null
                : bookingRepository.findById(payment.getBookingId()).map(Booking::getPlayerId).orElse(null);
        return Complaint.builder()
                .locationId(payment.getLocationId())
                .bookingId(payment.getBookingId())
                .paymentId(payment.getId())
                .playerId(playerId)
                .createdBy(user.getId())
                .complaintType(type)
                .content(request.getContent().trim())
                .status(ComplaintStatus.PENDING_OWNER)
                .handledBy(user.getId())
                .build();
    }

    // ---------------------------------------------------------------- Xem khiếu nại

    @Transactional(readOnly = true)
    public PageResponse<ComplaintResponse> listMine(Long userId, int page, int size) {
        return toPage(complaintRepository.findByCreatedBy(userId, pageable(page, size)));
    }

    @Transactional(readOnly = true)
    public PageResponse<ComplaintResponse> listForStaff(UserPrincipal staff, String status, int page, int size) {
        return toPage(complaintRepository.findByLocation(staff.getLocationId(), parseStatus(status), null,
                pageable(page, size)));
    }

    /** Owner chỉ thấy khiếu nại đã được Staff chuyển lên. */
    @Transactional(readOnly = true)
    public PageResponse<ComplaintResponse> listForOwner(Long ownerId, String status, int page, int size) {
        Location location = findOwnerLocation(ownerId);
        return toPage(complaintRepository.findByLocation(location.getId(), parseStatus(status),
                ComplaintStatus.SUBMITTED, pageable(page, size)));
    }

    @Transactional(readOnly = true)
    public ComplaintResponse getComplaint(UserPrincipal user, Long id) {
        Complaint complaint = findComplaint(id);
        boolean allowed = switch (user.getRole()) {
            case PLAYER -> user.getId().equals(complaint.getCreatedBy());
            case STAFF -> complaint.getLocationId().equals(user.getLocationId());
            case OWNER -> complaint.getStatus() != ComplaintStatus.SUBMITTED
                    && locationRepository.findByOwnerId(user.getId())
                            .map(l -> l.getId().equals(complaint.getLocationId())).orElse(false);
            case ADMIN -> true;
        };
        if (!allowed) {
            throw new AppException("Bạn không có quyền xem khiếu nại này", HttpStatus.FORBIDDEN);
        }
        return toResponses(List.of(complaint)).get(0);
    }

    // ---------------------------------------------------------------- Staff chuyển khiếu nại

    @Transactional
    public ComplaintResponse forward(UserPrincipal staff, Long id, ForwardComplaintRequest request) {
        Complaint complaint = findComplaint(id);
        if (!complaint.getLocationId().equals(staff.getLocationId())) {
            throw new AppException("Khiếu nại không thuộc địa điểm của bạn", HttpStatus.FORBIDDEN);
        }
        if (complaint.getStatus() != ComplaintStatus.SUBMITTED) {
            throw new AppException("Chỉ chuyển được khiếu nại vừa gửi");
        }
        complaint.setStaffNote(request.getStaffNote().trim());
        complaint.setHandledBy(staff.getId());
        complaint.setStatus(ComplaintStatus.PENDING_OWNER);
        complaintRepository.save(complaint);

        notifyOwner(complaint, "Có khiếu nại cần chủ sân xử lý");
        return toResponses(List.of(complaint)).get(0);
    }

    // ---------------------------------------------------------------- Owner xử lý

    @Transactional
    public ComplaintResponse resolve(Long ownerId, Long id, ResolveComplaintRequest request) {
        Complaint complaint = findPendingForOwner(ownerId, id);
        ComplaintResult result = request.getResult();
        boolean latePayment = Complaint.TYPE_LATE_PAYMENT_CONFIRMATION.equals(complaint.getComplaintType());
        if (latePayment != (result == ComplaintResult.LATE_PAYMENT_CONFIRMED)) {
            throw new AppException(latePayment
                    ? "Khiếu nại xác nhận thanh toán trễ chỉ có kết quả LATE_PAYMENT_CONFIRMED hoặc bị từ chối"
                    : "Kết quả LATE_PAYMENT_CONFIRMED chỉ dùng cho khiếu nại xác nhận thanh toán trễ");
        }

        String note = request.getNote() == null || request.getNote().isBlank() ? null : request.getNote().trim();
        switch (result) {
            case REFUND -> createRefundRequest(complaint, request.getRefundAmount(), note);
            case POINTS -> grantCompensationPoints(ownerId, complaint, request.getCompensationPoints(), note);
            default -> { }
        }

        complaint.setResult(result);
        complaint.setStatus(ComplaintStatus.RESOLVED);
        if (result == ComplaintResult.POINTS) {
            complaint.setCompensationPoints(request.getCompensationPoints());
        }
        decide(complaint, ownerId);
        complaintRepository.save(complaint);

        String content = "Khiếu nại #" + complaint.getId() + " đã được xử lý: " + describe(result)
                + (note == null ? "" : ". " + note);
        notifyRequester(complaint, "COMPLAINT_RESOLVED", "Khiếu nại đã được xử lý", content);
        return toResponses(List.of(complaint)).get(0);
    }

    @Transactional
    public ComplaintResponse reject(Long ownerId, Long id, RejectComplaintRequest request) {
        Complaint complaint = findPendingForOwner(ownerId, id);
        complaint.setStatus(ComplaintStatus.REJECTED);
        complaint.setRejectReason(request.getReason().trim());
        decide(complaint, ownerId);
        complaintRepository.save(complaint);

        notifyRequester(complaint, "COMPLAINT_REJECTED", "Khiếu nại bị từ chối",
                truncate("Khiếu nại #" + complaint.getId() + " bị từ chối: " + complaint.getRejectReason(), 500));
        return toResponses(List.of(complaint)).get(0);
    }

    private void createRefundRequest(Complaint complaint, BigDecimal amount, String note) {
        if (complaint.getBookingId() == null) {
            throw new AppException("Khiếu nại không gắn booking nên không tạo được yêu cầu hoàn tiền");
        }
        Booking booking = findBooking(complaint.getBookingId());
        BigDecimal suggested = amount != null ? amount : booking.getFinalAmount();
        if (suggested.signum() <= 0 || suggested.compareTo(booking.getFinalAmount()) > 0) {
            throw new AppException("Số tiền hoàn phải lớn hơn 0 và không vượt quá số tiền booking");
        }
        LocalDateTime paidAt = booking.getCreatedAt();
        if (complaint.getPaymentId() != null) {
            Payment payment = findPayment(complaint.getPaymentId());
            paidAt = payment.getConfirmedAt() != null ? payment.getConfirmedAt() : payment.getCreatedAt();
        }
        LocalDate originalPaymentDate = paidAt.toLocalDate();

        refundRequestRepository.save(RefundRequest.builder()
                .locationId(complaint.getLocationId())
                .bookingId(booking.getId())
                .complaintId(complaint.getId())
                .suggestedAmount(suggested)
                .originalPaymentDate(originalPaymentDate)
                .reason(note != null ? note : "Hoàn tiền theo khiếu nại #" + complaint.getId())
                .build());
    }

    private void grantCompensationPoints(Long ownerId, Complaint complaint, Integer points, String note) {
        if (points == null || points <= 0) {
            throw new AppException("Số điểm bồi thường phải lớn hơn 0");
        }
        Long bookingId = complaint.getBookingId();
        if (bookingId == null && complaint.getPaymentId() != null) {
            bookingId = findPayment(complaint.getPaymentId()).getBookingId();
        }
        Long playerId = complaint.getPlayerId();
        if (bookingId == null || playerId == null) {
            throw new AppException("Khiếu nại không xác định được booking và người chơi để cộng điểm");
        }

        PlayerLocationBalance balance = balanceRepository
                .findByPlayerIdAndLocationId(playerId, complaint.getLocationId())
                .orElseGet(() -> PlayerLocationBalance.builder()
                        .playerId(playerId)
                        .locationId(complaint.getLocationId())
                        .build());
        balance.setPointBalance(balance.getPointBalance() + points);
        balance.setUpdatedAt(LocalDateTime.now());
        balance = balanceRepository.save(balance);

        pointTransactionRepository.save(PointTransaction.builder()
                .balanceId(balance.getId())
                .bookingId(bookingId)
                .type(PointTransactionType.ADJUST)
                .points(points)
                .balanceAfter(balance.getPointBalance())
                .reason(truncate("Bồi thường khiếu nại #" + complaint.getId() + (note == null ? "" : ": " + note), 255))
                .createdBy(ownerId)
                .build());
    }

    private Complaint findPendingForOwner(Long ownerId, Long id) {
        Complaint complaint = findComplaint(id);
        Location location = findOwnerLocation(ownerId);
        if (!location.getId().equals(complaint.getLocationId())) {
            throw new AppException("Khiếu nại không thuộc địa điểm của bạn", HttpStatus.FORBIDDEN);
        }
        if (complaint.getStatus() != ComplaintStatus.PENDING_OWNER) {
            throw new AppException("Chỉ xử lý được khiếu nại đang chờ chủ sân");
        }
        return complaint;
    }

    private void decide(Complaint complaint, Long ownerId) {
        complaint.setDecidedBy(ownerId);
        complaint.setDecidedAt(LocalDateTime.now());
    }

    private String describe(ComplaintResult result) {
        return switch (result) {
            case LATE_PAYMENT_CONFIRMED -> "xác nhận thanh toán trễ";
            case REFUND -> "hoàn tiền";
            case POINTS -> "bồi thường bằng điểm";
            case NO_COMPENSATION -> "không bồi thường";
        };
    }

    // ---------------------------------------------------------------- helpers

    private Complaint findComplaint(Long id) {
        return complaintRepository.findById(id)
                .orElseThrow(() -> new AppException("Không tìm thấy khiếu nại", HttpStatus.NOT_FOUND));
    }

    private Booking findBooking(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new AppException("Không tìm thấy booking", HttpStatus.NOT_FOUND));
    }

    private Payment findPayment(Long id) {
        return paymentRepository.findById(id)
                .orElseThrow(() -> new AppException("Không tìm thấy khoản thanh toán", HttpStatus.NOT_FOUND));
    }

    private Location findOwnerLocation(Long ownerId) {
        return locationRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new AppException("Bạn chưa có địa điểm nào", HttpStatus.NOT_FOUND));
    }

    private ComplaintStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return ComplaintStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("Trạng thái khiếu nại không hợp lệ");
        }
    }

    private Pageable pageable(int page, int size) {
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    private void notifyOwner(Complaint complaint, String title) {
        locationRepository.findById(complaint.getLocationId()).ifPresent(location ->
                notify(location.getOwnerId(), "COMPLAINT_FORWARDED", title,
                        truncate(complaint.getContent(), 500), complaint));
    }

    /** Thông báo cho người gửi; khiếu nại do Staff tạo thì thông báo cả Staff đó và người chơi liên quan. */
    private void notifyRequester(Complaint complaint, String type, String title, String content) {
        notify(complaint.getCreatedBy(), type, title, content, complaint);
        if (complaint.getPlayerId() != null && !complaint.getPlayerId().equals(complaint.getCreatedBy())) {
            notify(complaint.getPlayerId(), type, title, content, complaint);
        }
    }

    private void notify(Long recipientId, String type, String title, String content, Complaint complaint) {
        notificationRepository.save(Notification.builder()
                .recipientId(recipientId)
                .type(type)
                .title(title)
                .content(content)
                .refType("COMPLAINT")
                .refId(complaint.getId())
                .build());
    }

    private PageResponse<ComplaintResponse> toPage(Page<Complaint> page) {
        return PageResponse.<ComplaintResponse>builder()
                .content(toResponses(page.getContent()))
                .pageNumber(page.getNumber())
                .pageSize(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .isLast(page.isLast())
                .build();
    }

    private List<ComplaintResponse> toResponses(Collection<Complaint> complaints) {
        Map<Long, String> locationNames = locationRepository
                .findAllById(complaints.stream().map(Complaint::getLocationId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Location::getId, Location::getName));
        Map<Long, String> playerNames = accountRepository
                .findAllById(complaints.stream().map(Complaint::getPlayerId)
                        .filter(java.util.Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Account::getId, Account::getFullName));
        Map<Long, String> bookingCodes = bookingRepository
                .findAllById(complaints.stream().map(Complaint::getBookingId)
                        .filter(java.util.Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Booking::getId, Booking::getBookingCode));

        return complaints.stream().map(c -> ComplaintResponse.builder()
                .id(c.getId())
                .locationId(c.getLocationId())
                .locationName(locationNames.get(c.getLocationId()))
                .bookingId(c.getBookingId())
                .bookingCode(c.getBookingId() == null ? null : bookingCodes.get(c.getBookingId()))
                .paymentId(c.getPaymentId())
                .playerId(c.getPlayerId())
                .playerName(c.getPlayerId() == null ? null : playerNames.get(c.getPlayerId()))
                .createdBy(c.getCreatedBy())
                .complaintType(c.getComplaintType())
                .content(c.getContent())
                .status(c.getStatus().name())
                .staffNote(c.getStaffNote())
                .handledBy(c.getHandledBy())
                .result(c.getResult() == null ? null : c.getResult().name())
                .rejectReason(c.getRejectReason())
                .compensationPoints(c.getCompensationPoints())
                .decidedBy(c.getDecidedBy())
                .decidedAt(c.getDecidedAt())
                .createdAt(c.getCreatedAt())
                .build()).toList();
    }

    private static String truncate(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max);
    }
}
