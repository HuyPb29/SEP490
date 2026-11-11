package com.sep490.bms.service.reschedule;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import com.sep490.bms.dto.request.*;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.booking.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.payment.*;
import com.sep490.bms.entity.reschedule.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.security.*;
import com.sep490.bms.service.booking.*;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.promotion.LoyaltyPointService;
import com.sep490.bms.service.team.MatchService;
import jakarta.persistence.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Tính chênh lệch, quản lý slot giữ khi đổi lịch và xử lý xác nhận phụ thu.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RescheduleService {
    private final EntityManager em;
    private final BookingChangeSupport support;
    private final SlotAvailabilityService availability;
    private final PriceCalculator prices;
    private final LocationAccessService access;
    private final LoyaltyPointService points;
    private final FileStorageService storage;
    private final MatchService matches;
    // SRS parameter table P02/P03/P04/P05/P25: fixed values, no Owner settings.
    private final int cutoffHours=6;
    private final int cutoffPercent=50;
    private final int bufferMinutes=60;
    private final int holdMinutes=5;

    @jakarta.annotation.PostConstruct
    void validatePolicy() {
        if(cutoffHours<0 || cutoffPercent<0 || cutoffPercent>100 || bufferMinutes<0 || holdMinutes<1)
            throw new IllegalStateException("Invalid reschedule timing policy");
    }

    public record Quote(BigDecimal oldListAmount, BigDecimal newListAmount, BigDecimal amountPaid,
            BigDecimal extraAmount, LocalDateTime rescheduleDeadline, LocalDateTime approveDeadline, boolean free) {
        public boolean isNoDifferenceRefund() {
            return !free && newListAmount.compareTo(oldListAmount) < 0;
        }
    }
    public record Instructions(Long requestId, BigDecimal amountDue, LocalDateTime holdExpiresAt,
            LocalDateTime approveDeadline, String bankName, String bankAccountNo, String bankAccountHolder,
            String qrImageUrl, String transferContent) {}
    public record PaymentView(Payment payment, List<PaymentProof> proofs) {}
    public record PaymentProgress(Long id, PaymentStatus status, LocalDateTime resubmitDeadline,
            String resubmitReason, int resubmitsLeft) {}

    public List<Payment> staffPayments(UserPrincipal u,PaymentStatus status) {
        Long location=access.selectedLocation(u).getId();
        return em.createQuery("select p from Payment p where p.locationId=:l and p.rescheduleRequestId is not null and p.status=:s order by p.submittedAt,p.id",Payment.class)
                .setParameter("l",location).setParameter("s",status==null?PaymentStatus.AWAITING_CONFIRMATION:status).getResultList();
    }
    public PaymentView payment(UserPrincipal u,Long id) {
        Payment p=em.find(Payment.class,id);
        if(p==null) throw new AppException("Không tìm thấy thanh toán",HttpStatus.NOT_FOUND);
        if(p.getRescheduleRequestId()==null) throw new AppException("Không tìm thấy thanh toán phụ thu đổi lịch",HttpStatus.NOT_FOUND);
        RescheduleRequest r=find(p.getRescheduleRequestId());Booking b=support.booking(r.getBookingId());
        if(u.getRole()==Role.PLAYER) support.player(u,b);
        else if(!access.selectedLocation(u).getId().equals(b.getLocationId())) throw new AppException("Sai địa điểm",HttpStatus.FORBIDDEN);
        return new PaymentView(p,em.createQuery("select p from PaymentProof p where p.paymentId=:id order by p.id",PaymentProof.class).setParameter("id",id).getResultList());
    }

    public LocalDateTime deadline(Booking b) {
        LocalDateTime start = support.start(b);
        long seconds = Math.max(0, Duration.between(b.getCreatedAt(), start).getSeconds());
        long cutoff = Math.min(cutoffHours * 3600L, seconds * cutoffPercent / 100);
        return start.minusSeconds(cutoff);
    }
    private boolean pending(RescheduleRequest r) {
        return r.getStatus() == RescheduleStatus.PENDING_PAYMENT || r.getStatus() == RescheduleStatus.AWAITING_CONFIRMATION;
    }
    public List<RescheduleRequest> requests(UserPrincipal u, Long bookingId) {
        Booking b = support.booking(bookingId); support.player(u, b);
        return all(b);
    }
    public RescheduleRequest detail(UserPrincipal u, Long id) {
        RescheduleRequest r = find(id); Booking b = support.booking(r.getBookingId()); support.player(u,b);
        return r;
    }
    private RescheduleRequest find(Long id) {
        RescheduleRequest r = em.find(RescheduleRequest.class, id);
        if (r == null) throw new AppException("Không tìm thấy yêu cầu đổi lịch", HttpStatus.NOT_FOUND);
        return r;
    }
    private List<RescheduleRequest> all(Booking b) {
        return em.createQuery("select r from RescheduleRequest r where r.bookingId=:id order by r.id desc", RescheduleRequest.class)
                .setParameter("id",b.getId()).getResultList();
    }
    public LocalDateTime playerDeadline(UserPrincipal user, Long bookingId) {
        Booking booking = support.booking(bookingId);
        support.player(user, booking);
        return deadline(booking);
    }

    public Quote preview(UserPrincipal u, Long id, ReschedulePreviewRequest slot) {
        Booking b = support.booking(id); support.player(u,b); expireFor(b);
        return quote(b,slot,false);
    }
    public RescheduleRequest create(UserPrincipal u, Long id, ReschedulePreviewRequest slot) {
        Booking b = support.booking(id); support.player(u,b); expireFor(b);
        return createFor(b,slot,false);
    }
    /** Facility choice already holds the booking lock and bypasses only the paid-reschedule cutoff/count. */
    public RescheduleRequest createFree(Booking b, ReschedulePreviewRequest slot) {
        return createFor(b,slot,true);
    }
    private Quote quote(Booking b, ReschedulePreviewRequest slot, boolean free) {
        support.confirmed(b); support.paid(b);
        if (b.getBookingType() == BookingType.WALK_IN) throw new AppException("Booking tại quầy không đổi lịch online");
        if (!free && (b.getRescheduleCount() >= 1 || !LocalDateTime.now().isBefore(deadline(b))))
            throw new AppException("Đã hết hạn hoặc hết lượt đổi lịch", HttpStatus.CONFLICT);
        if (all(b).stream().anyMatch(this::pending)) throw new AppException("Đang có yêu cầu đổi lịch", HttpStatus.CONFLICT);
        if (!free && !em.createQuery("select a from AffectedBooking a where a.bookingId=:id and a.status=:s", AffectedBooking.class)
                .setParameter("id", b.getId()).setParameter("s", AffectedStatus.PENDING).getResultList().isEmpty())
            throw new AppException("Hãy chọn xử lý booking bị ảnh hưởng", HttpStatus.CONFLICT);
        if (slot == null || slot.courtId() == null || slot.date() == null || !slot.isValidSlot()
                || slot.startMinute()<0 || slot.endMinute()>1440) throw new AppException("Slot không hợp lệ");
        Court c = support.lock(Court.class,slot.courtId());
        Location l = em.find(Location.class,b.getLocationId());
        if (!c.getLocationId().equals(b.getLocationId()) || !c.isActive() || !"ACTIVE".equals(l.getStatus()))
            throw new AppException("Sân phải hoạt động và thuộc cùng địa điểm");
        LocalDateTime newStart = slot.date().atStartOfDay().plusMinutes(slot.startMinute());
        if (!newStart.isAfter(LocalDateTime.now())) throw new AppException("Slot mới phải ở tương lai");
        BookingPackage pkg = b.getPackageId()==null ? null : em.find(BookingPackage.class,b.getPackageId());
        // BR31: buổi trong gói đổi trong thời hạn gói; booking lẻ và booking của đơn đặt lẻ (BR64) theo BR02.
        if (pkg!=null && pkg.getPackageType()!=PackageType.DAY) {
            if (slot.date().isBefore(pkg.getStartDate()) || slot.date().isAfter(pkg.getEndDate()))
                throw new AppException("Slot mới ngoài thời hạn gói");
        } else if (slot.date().isAfter(LocalDate.now().plusDays(l.getAdvanceBookingDays())))
            throw new AppException("Slot mới vượt hạn đặt trước");
        // Minh's shared slot API reports a problem instead of returning an availability boolean.
        // Preserve UC21's rejection rule for closed, occupied or maintenance-blocked target slots.
        if (availability.findProblem(l.getId(),c.getId(),slot.date(),slot.startMinute(),slot.endMinute()).isPresent())
            throw new AppException("Slot mới không còn trống hoặc ngoài giờ mở cửa",HttpStatus.CONFLICT);
        BigDecimal newPrice = prices.totalPrice(c.getId(),slot.date(),slot.startMinute(),slot.endMinute());
        BigDecimal extra = free ? BigDecimal.ZERO : newPrice.subtract(b.getListAmount()).max(BigDecimal.ZERO);
        LocalDateTime approve = (newStart.isBefore(support.start(b)) ? newStart : support.start(b)).minusMinutes(bufferMinutes);
        if (extra.signum()>0 && !approve.isAfter(LocalDateTime.now()))
            throw new AppException("Không còn thời gian xác nhận phụ thu",HttpStatus.CONFLICT);
        return new Quote(b.getListAmount(),newPrice,support.paidAmount(b),extra,deadline(b),approve,free);
    }
    private RescheduleRequest createFor(Booking b, ReschedulePreviewRequest slot, boolean free) {
        Quote q=quote(b,slot,free);
        LocalDateTime hold=LocalDateTime.now().plusMinutes(holdMinutes);
        if(hold.isAfter(q.approveDeadline())) hold=q.approveDeadline();
        RescheduleRequest r=RescheduleRequest.builder().bookingId(b.getId()).newCourtId(slot.courtId()).newDate(slot.date())
                .newStartMinute(slot.startMinute()).newEndMinute(slot.endMinute()).oldListAmount(q.oldListAmount())
                .newListAmount(q.newListAmount()).extraAmount(q.extraAmount()).free(free)
                .status(RescheduleStatus.PENDING_PAYMENT).holdExpiresAt(hold).approveDeadline(q.approveDeadline()).build();
        em.persist(r); em.flush();
        Map<Integer,BigDecimal> slotPrices=prices.slotPrices(List.of(slot.courtId()),slot.date()).get(slot.courtId());
        for(int m=slot.startMinute();m<slot.endMinute();m+=30)
            em.persist(BookingSlot.builder().bookingId(b.getId()).courtId(slot.courtId()).slotDate(slot.date())
                    .slotStartMinute(m).price(slotPrices.get(m)).rescheduleRequestId(r.getId()).build());
        em.flush();
        if(q.extraAmount().signum()==0) approve(r,b);
        return r;
    }
    private void approve(RescheduleRequest r, Booking b) {
        // Preserve target holds; release every previous active slot, including prior successful reschedules.
        for(var s:em.createQuery("select s from BookingSlot s where s.bookingId=:id and s.active=true",BookingSlot.class)
                .setParameter("id",b.getId()).getResultList()) if(!r.getId().equals(s.getRescheduleRequestId())) s.setActive(false);
        b.setCourtId(r.getNewCourtId()); b.setPlayDate(r.getNewDate()); b.setStartMinute(r.getNewStartMinute()); b.setEndMinute(r.getNewEndMinute());
        // Keep the original booking-time list price and all payment/discount snapshots (BR08/BR30).
        if(!r.isFree()) b.setRescheduleCount(b.getRescheduleCount()+1);
        b.setUpdatedAt(LocalDateTime.now()); r.setStatus(RescheduleStatus.APPROVED); r.setDecidedAt(LocalDateTime.now());
        support.notify(b.getPlayerId(),"RESCHEDULE_RESULT","Đổi lịch thành công cho "+b.getBookingCode(),b.getId());
        em.flush(); // MatchService reads the new slot through JDBC in the same transaction.
        matches.onBookingRescheduled(b.getId());
    }
    private void finish(RescheduleRequest r, Booking b, RescheduleStatus status) {
        r.setStatus(status); r.setDecidedAt(LocalDateTime.now()); support.release(b.getId(),r.getId());
        for(Payment p:em.createQuery("select p from Payment p where p.rescheduleRequestId=:id",Payment.class).setParameter("id",r.getId()).getResultList())
            if(p.getStatus()!=PaymentStatus.CONFIRMED) { p.setStatus(PaymentStatus.REJECTED); p.setRejectReason("Yêu cầu đổi lịch "+status); }
        support.notify(b.getPlayerId(),"RESCHEDULE_RESULT","Yêu cầu đổi lịch "+status+"; giữ lịch cũ",b.getId());
    }
    private boolean expire(RescheduleRequest r,Booking b) {
        LocalDateTime now=LocalDateTime.now();
        if(pending(r) && ((r.getApproveDeadline()!=null && !now.isBefore(r.getApproveDeadline()))
                || (r.getStatus()==RescheduleStatus.PENDING_PAYMENT && r.getHoldExpiresAt()!=null && !now.isBefore(r.getHoldExpiresAt())))) {
            finish(r,b,RescheduleStatus.EXPIRED);
            support.notify(em.find(Location.class,b.getLocationId()).getOwnerId(), "RESCHEDULE_EXPIRED",
                    "Yêu cầu đổi lịch của " + b.getBookingCode() + " đã hết hạn, giữ lịch cũ", b.getId());
            return true;
        }
        return false;
    }
    public void expireFor(Booking b) { for(var r:all(b)) if(pending(r)) { em.refresh(r,LockModeType.PESSIMISTIC_WRITE); expire(r,b); } }
    public void rejectPending(Booking b) { for(var r:all(b)) if(pending(r)) { em.refresh(r,LockModeType.PESSIMISTIC_WRITE); finish(r,b,RescheduleStatus.REJECTED); } }
    public void expireRequest(Long id) {
        RescheduleRequest r=find(id); Booking b=support.booking(r.getBookingId()); em.refresh(r,LockModeType.PESSIMISTIC_WRITE); expire(r,b);
    }
    public PaymentProgress paymentForRequest(UserPrincipal user, Long requestId) {
        detail(user, requestId);
        return em.createQuery("select p from Payment p where p.rescheduleRequestId = :requestId order by p.id desc", Payment.class)
                .setParameter("requestId", requestId)
                .setMaxResults(1)
                .getResultList().stream()
                .findFirst()
                .map(payment -> new PaymentProgress(payment.getId(), payment.getStatus(), payment.getResubmitDeadline(),
                        payment.getResubmitReason(), Math.max(0, Payment.MAX_RESUBMITS - payment.getResubmitCount())))
                .orElse(null);
    }

    public Instructions instructions(UserPrincipal u,Long id) {
        RescheduleRequest request = detail(u, id);
        Booking booking = support.booking(request.getBookingId());
        Location location = em.find(Location.class, booking.getLocationId());
        String qrPath = location.getQrImagePath() == null ? null : "/api/reschedule-requests/" + id + "/payment-instructions/qr";
        return new Instructions(id, request.getExtraAmount(), request.getHoldExpiresAt(), request.getApproveDeadline(),
                location.getBankName(), location.getBankAccountNo(), location.getBankAccountHolder(), qrPath,
                booking.getBookingCode() + " DL" + id);
    }
    public org.springframework.core.io.Resource qr(UserPrincipal u,Long id) {
        RescheduleRequest request=detail(u,id);
        String path=em.find(Location.class,support.booking(request.getBookingId()).getLocationId()).getQrImagePath();
        if(path==null) throw new AppException("Chưa có ảnh QR",HttpStatus.NOT_FOUND);
        return storage.load(path);
    }
    public RescheduleRequest submit(UserPrincipal u,Long id,MultipartFile proof) {
        RescheduleRequest r=detail(u,id);
        Booking locked=support.booking(r.getBookingId());em.refresh(r,LockModeType.PESSIMISTIC_WRITE);expire(r,locked);
        if(r.getStatus()==RescheduleStatus.EXPIRED) return r; // persist expiry instead of rolling it back with an exception
        if(r.getStatus()!=RescheduleStatus.PENDING_PAYMENT) throw new AppException("Yêu cầu không chờ phụ thu",HttpStatus.CONFLICT);
        if (proof == null || proof.isEmpty()) throw new AppException("Vui lòng đính kèm ảnh chứng từ (MSG49)");
        Payment p=Payment.builder().locationId(locked.getLocationId()).rescheduleRequestId(id).amountDue(r.getExtraAmount())
                .submittedAt(LocalDateTime.now()).build(); em.persist(p);em.flush();
        em.persist(PaymentProof.builder().paymentId(p.getId()).imagePath(storage.storeImage(proof,"payment-proofs")).build());
        r.setStatus(RescheduleStatus.AWAITING_CONFIRMATION); return r;
    }
    public RescheduleRequest requestResubmission(UserPrincipal u,Long paymentId,com.sep490.bms.dto.payment.ResubmitRequest input) {
        Payment observed=em.find(Payment.class,paymentId);
        if(observed==null || observed.getRescheduleRequestId()==null) throw new AppException("Không tìm thấy phụ thu",HttpStatus.NOT_FOUND);
        RescheduleRequest r=find(observed.getRescheduleRequestId()); Booking b=support.booking(r.getBookingId());
        if(!access.selectedLocation(u).getId().equals(b.getLocationId())) throw new AppException("Sai địa điểm",HttpStatus.FORBIDDEN);
        em.refresh(r,LockModeType.PESSIMISTIC_WRITE); Payment p=support.lock(Payment.class,paymentId);
        if(expire(r,b)) return r;
        if(r.getStatus()!=RescheduleStatus.AWAITING_CONFIRMATION || p.getStatus()!=PaymentStatus.AWAITING_CONFIRMATION)
            throw new AppException("Thanh toán không chờ xác nhận",HttpStatus.CONFLICT);
        if(input.playerAtFault() && p.noResubmitLeft()) { finish(r,b,RescheduleStatus.REJECTED); return r; }
        p.requestResubmission(input.reason().trim(),r.getApproveDeadline(),input.playerAtFault());
        support.notify(b.getPlayerId(),"PAYMENT_RESUBMIT","Cần bổ sung thanh toán phụ thu: "+input.reason(),b.getId());
        return r;
    }
    public RescheduleRequest resubmit(UserPrincipal u,Long paymentId,MultipartFile proof) {
        Payment observed=em.find(Payment.class,paymentId);
        if(observed==null || observed.getRescheduleRequestId()==null) throw new AppException("Không tìm thấy phụ thu",HttpStatus.NOT_FOUND);
        RescheduleRequest r=find(observed.getRescheduleRequestId()); Booking b=support.booking(r.getBookingId());support.player(u,b);
        em.refresh(r,LockModeType.PESSIMISTIC_WRITE);Payment p=support.lock(Payment.class,paymentId);
        if(expire(r,b)) return r;
        if(r.getStatus()!=RescheduleStatus.AWAITING_CONFIRMATION || p.getStatus()!=PaymentStatus.RESUBMIT_REQUESTED)
            throw new AppException("Chưa được yêu cầu bổ sung",HttpStatus.CONFLICT);
        if(proof==null || proof.isEmpty()) throw new AppException("Cần ảnh chứng từ bổ sung (MSG106)");
        em.persist(PaymentProof.builder().paymentId(p.getId()).imagePath(storage.storeImage(proof,"payment-proofs")).build());
        p.resubmitted(LocalDateTime.now()); return r;
    }
    /** UC21 reschedule-payment endpoints delegate here; booking payments use Minh's PaymentService. */
    public RescheduleRequest decidePayment(UserPrincipal u,Long paymentId,boolean confirm,ReschedulePaymentDecision input) {
        Payment observed=em.find(Payment.class,paymentId);
        if(observed==null) throw new AppException("Không tìm thấy thanh toán",HttpStatus.NOT_FOUND);
        if(observed.getRescheduleRequestId()==null) throw new AppException("Không tìm thấy thanh toán phụ thu đổi lịch",HttpStatus.NOT_FOUND);
        RescheduleRequest r=find(observed.getRescheduleRequestId()); Booking b=support.booking(r.getBookingId());
        if(!access.selectedLocation(u).getId().equals(b.getLocationId())) throw new AppException("Sai địa điểm",HttpStatus.FORBIDDEN);
        em.refresh(r,LockModeType.PESSIMISTIC_WRITE); Payment p=support.lock(Payment.class,paymentId);
        if(expire(r,b)) return r;
        if(r.getStatus()!=RescheduleStatus.AWAITING_CONFIRMATION || p.getStatus()!=PaymentStatus.AWAITING_CONFIRMATION)
            throw new AppException("Thanh toán đã được xử lý",HttpStatus.CONFLICT);
        if(confirm) {
            support.confirmed(b);
            Court target=support.lock(Court.class,r.getNewCourtId());
            boolean usable=target.isActive() && "ACTIVE".equals(em.find(Location.class,b.getLocationId()).getStatus())
                    && availability.openingWindow(b.getLocationId(),r.getNewDate()).filter(w->w.covers(r.getNewStartMinute(),r.getNewEndMinute())).isPresent();
            Set<Integer> maintenance=availability.maintenanceStarts(List.of(target.getId()),r.getNewDate()).getOrDefault(target.getId(),Set.of());
            for(int m=r.getNewStartMinute();m<r.getNewEndMinute();m+=30) if(maintenance.contains(m)) usable=false;
            if(!usable) { finish(r,b,RescheduleStatus.REJECTED); return r; }
            BigDecimal received=input==null || input.receivedAmount()==null ? p.getAmountDue() : input.receivedAmount();
            if(received.compareTo(p.getAmountDue())<0) throw new AppException("Số tiền nhận chưa đủ");
            p.setReceivedAmount(received);p.setStatus(PaymentStatus.CONFIRMED);p.setConfirmedAt(LocalDateTime.now());p.setConfirmedBy(u.getId());
            p.setReceiptNo("RS"+p.getId()); approve(r,b); em.flush(); points.accrueForConfirmedPayment(p.getId());
            if(received.compareTo(p.getAmountDue())>0) support.notify(em.find(Location.class,b.getLocationId()).getOwnerId(),"PAYMENT_OVERPAID","Có thanh toán phụ thu chuyển thừa",b.getId());
        } else {
            if(input==null || input.reason()==null || input.reason().isBlank()) throw new AppException("Cần lý do từ chối");
            finish(r,b,RescheduleStatus.REJECTED); p.setRejectReason(input.reason().trim()); p.setConfirmedBy(u.getId());
        }
        return r;
    }
}
