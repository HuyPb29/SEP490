package com.sep490.bms.service.reschedule;

import java.time.*;
import java.util.List;
import com.sep490.bms.dto.request.*;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.booking.BookingPackage;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.location.Maintenance;
import com.sep490.bms.entity.reschedule.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.security.*;
import com.sep490.bms.service.booking.SlotAvailabilityService;
import com.sep490.bms.service.promotion.*;
import jakarta.persistence.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xử lý hủy booking, đánh dấu booking bị ảnh hưởng và thực hiện phương án của Player.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class CancellationService {
    private final EntityManager em;
    private final BookingChangeSupport support;
    private final RescheduleService reschedules;
    private final LocationAccessService access;
    private final LoyaltyPointService points;
    private final VoucherService vouchers;
    private final SlotAvailabilityService availability;

    public record CancellableBooking(Long id, String bookingCode, Long courtId, int startMinute, int endMinute,
            BookingType bookingType) {}

    @Transactional(readOnly = true)
    public List<CancellableBooking> ownerBookings(UserPrincipal user, LocalDate playDate) {
        LocalDateTime now = LocalDateTime.now();
        return em.createQuery("""
                select b from Booking b
                where b.locationId = :locationId and b.status = :status and b.playDate = :playDate
                and not exists (select a from AffectedBooking a where a.bookingId = b.id and a.status = :affectedStatus)
                order by b.startMinute, b.id
                """, Booking.class)
                .setParameter("locationId", access.selectedLocation(user).getId())
                .setParameter("status", BookingStatus.CONFIRMED)
                .setParameter("playDate", playDate)
                .setParameter("affectedStatus", AffectedStatus.PENDING)
                .getResultList().stream()
                .filter(booking -> support.start(booking).isAfter(now))
                .map(booking -> new CancellableBooking(booking.getId(), booking.getBookingCode(), booking.getCourtId(),
                        booking.getStartMinute(), booking.getEndMinute(), booking.getBookingType()))
                .toList();
    }

    public Object ownerCancel(UserPrincipal u,Long id,OwnerCancellationRequest input) {
        if (u.getRole() != Role.OWNER) throw new AppException("Chỉ Owner được hủy booking", HttpStatus.FORBIDDEN);
        Booking b=support.booking(id);
        if(!access.selectedLocation(u).getId().equals(b.getLocationId())) throw new AppException("Sai địa điểm",HttpStatus.FORBIDDEN);
        support.confirmed(b);
        if(input.cause()==OwnerCancellationRequest.Cause.WALK_IN_CUSTOMER_REQUEST) {
            if(b.getBookingType()!=BookingType.WALK_IN) throw new AppException("Chỉ dùng cho khách tại quầy");
            cancelBooking(b,u.getId(),BookingStatus.CANCELLED_BY_PLAYER); return b;
        }
        return mark(b,AffectedCause.OWNER_CANCELLED,null,u.getId(),input.reason());
    }
    private List<AffectedBooking> pending(Booking b) {
        return em.createQuery("select a from AffectedBooking a where a.bookingId=:id and a.status=:s",AffectedBooking.class)
                .setParameter("id",b.getId()).setParameter("s",AffectedStatus.PENDING).getResultList();
    }
    private Object mark(Booking b,AffectedCause cause,Long maintenance,Long actor,String reason) {
        if(b.getStatus()!=BookingStatus.CONFIRMED || !support.start(b).isAfter(LocalDateTime.now())) return b;
        if(!pending(b).isEmpty()) return pending(b).get(0);
        reschedules.rejectPending(b);
        if(b.getBookingType()==BookingType.WALK_IN) {
            cancelBooking(b,actor,BookingStatus.CANCELLED_BY_FACILITY);
            support.notify(em.find(Location.class,b.getLocationId()).getOwnerId(),"WALK_IN_AFFECTED","Booking tại quầy bị ảnh hưởng; cần nhân viên lập khiếu nại cho khách",b.getId());
            return b;
        }
        support.paid(b);
        AffectedBooking a=AffectedBooking.builder().bookingId(b.getId()).cause(cause).maintenanceId(maintenance).createdBy(actor).build();
        em.persist(a);
        support.notify(b.getPlayerId(),"BOOKING_AFFECTED",reason+". Chọn đổi lịch miễn phí, hoàn tiền hoặc điểm bồi hoàn trước giờ chơi",b.getId());
        return a;
    }
    public List<AffectedBooking> list(UserPrincipal u) {
        if(u.getRole()!=Role.PLAYER) throw new AppException("Chỉ Player xem booking bị ảnh hưởng",HttpStatus.FORBIDDEN);
        return em.createQuery("select a from AffectedBooking a where a.bookingId in (select b.id from Booking b where b.playerId=:p) order by a.id desc",AffectedBooking.class)
                .setParameter("p",u.getId()).getResultList();
    }
    private AffectedBooking find(Long id) {
        AffectedBooking a=em.find(AffectedBooking.class,id);
        if(a==null) throw new AppException("Không tìm thấy booking bị ảnh hưởng",HttpStatus.NOT_FOUND);
        return a;
    }
    public AffectedBooking detail(UserPrincipal u,Long id) {
        AffectedBooking a=find(id); Booking b=support.booking(a.getBookingId()); support.player(u,b);
        return a;
    }
    public AffectedBooking choose(UserPrincipal u,Long id,AffectedChoiceRequest input) {
        AffectedBooking a=find(id);Booking b=support.booking(a.getBookingId());support.player(u,b);em.refresh(a,LockModeType.PESSIMISTIC_WRITE);
        if(a.getStatus()!=AffectedStatus.PENDING) throw new AppException("Lựa chọn đã được xử lý",HttpStatus.CONFLICT);
        if(!support.start(b).isAfter(LocalDateTime.now())) { settle(a,b,AffectedChoice.POINTS,true); return a; }
        support.confirmed(b);
        if(input.choice()==AffectedChoice.RESCHEDULE) {
            RescheduleRequest r=reschedules.createFree(b,input.slot());
            a.setChoice(AffectedChoice.RESCHEDULE);a.setStatus(AffectedStatus.RESOLVED);a.setChosenAt(LocalDateTime.now());a.setRescheduleRequestId(r.getId());
        } else settle(a,b,input.choice(),false);
        return a;
    }
    private void settle(AffectedBooking a,Booking b,AffectedChoice choice,boolean defaultChoice) {
        a.setChoice(choice);a.setDefaultChoice(defaultChoice);a.setStatus(AffectedStatus.RESOLVED);a.setChosenAt(LocalDateTime.now());
        cancelBooking(b,a.getCreatedBy(),BookingStatus.CANCELLED_BY_FACILITY);
        em.flush();
        if(choice==AffectedChoice.REFUND) {
            LocalDate original=support.basePayments(b).stream().filter(p->p.getStatus()==PaymentStatus.CONFIRMED)
                    .map(p->p.getConfirmedAt().toLocalDate()).min(LocalDate::compareTo).orElseThrow();
            em.persist(RefundRequest.builder().locationId(b.getLocationId()).bookingId(b.getId()).affectedBookingId(a.getId())
                    .suggestedAmount(support.paidAmount(b)).originalPaymentDate(original).reason("Hoàn tiền do cơ sở gây ảnh hưởng").build());
            support.notify(em.find(Location.class,b.getLocationId()).getOwnerId(),"REFUND_REQUEST","Có yêu cầu hoàn tiền cho "+b.getBookingCode(),b.getId());
        }
        em.flush();
        vouchers.restoreForFailedBooking(b.getId());
        points.settleFacilityCancellation(a.getId());
        support.notify(b.getPlayerId(),"AFFECTED_RESOLVED","Đã xử lý booking theo lựa chọn "+choice+(defaultChoice?" (mặc định)":""),b.getId());
    }
    private void cancelBooking(Booking b,Long actor,BookingStatus status) {
        reschedules.rejectPending(b); support.release(b.getId(),null);
        b.setStatus(status);b.setCancelledBy(actor);b.setCancelledAt(LocalDateTime.now());b.setUpdatedAt(LocalDateTime.now());
        support.expireMatches(b);support.notify(b.getPlayerId(),"BOOKING_CANCELLED","Booking "+b.getBookingCode()+" đã hủy",b.getId());
    }
    public void defaultChoice(Long id) {
        AffectedBooking a=find(id);Booking b=support.booking(a.getBookingId());em.refresh(a,LockModeType.PESSIMISTIC_WRITE);
        if(a.getStatus()==AffectedStatus.PENDING && !support.start(b).isAfter(LocalDateTime.now())) settle(a,b,AffectedChoice.POINTS,true);
    }
    /** Cùng một tập booking cho xem trước MSG15 và xử lý UC22.
     * Lúc duyệt khóa cả booking đang chờ trong khoảng ngày, tránh đổi trạng thái giữa kiểm tra và xử lý.
     */
    public List<Booking> maintenanceImpact(Maintenance m, boolean lock) {
        var query = em.createQuery("select b from Booking b where b.courtId=:c and b.playDate between :first and :last order by b.id", Booking.class)
                .setParameter("c",m.getCourtId()).setParameter("first",m.getStartAt().toLocalDate())
                .setParameter("last",m.getEndAt().toLocalDate());
        if (lock) query.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        List<Booking> candidates = query.getResultList();
        if (lock) candidates.forEach(b -> em.refresh(b, LockModeType.PESSIMISTIC_WRITE));
        LocalDateTime now = LocalDateTime.now();
        return candidates.stream().filter(b -> b.getStatus()==BookingStatus.CONFIRMED
                && support.start(b).isAfter(now) && support.start(b).isBefore(m.getEndAt())
                && b.getPlayDate().atStartOfDay().plusMinutes(b.getEndMinute()).isAfter(m.getStartAt())).toList();
    }
    /** Giữ đường gọi cũ cho các luồng nội bộ; API F2 xác nhận danh sách trước khi gọi bản overload. */
    public void maintenanceApproved(Maintenance m,Long actor) {
        maintenanceApproved(m, actor, maintenanceImpact(m, true));
    }
    public void maintenanceApproved(Maintenance m,Long actor,List<Booking> confirmedImpact) {
        for (Booking b : confirmedImpact) mark(b,AffectedCause.MAINTENANCE,m.getId(),actor,"Sân bảo trì");
    }
    public void courtDisabled(Long courtId,Long actor) {
        var states = List.of(BookingStatus.CONFIRMED, BookingStatus.HOLDING,
                BookingStatus.AWAITING_CONFIRMATION, BookingStatus.RESUBMIT_REQUESTED);
        var candidates = em.createQuery("select b from Booking b where b.courtId=:c and b.status in :states order by b.id", Booking.class)
                .setParameter("c", courtId).setParameter("states", states).getResultList();
        for (Booking candidate : candidates) {
            // Caller holds Location first; then Payment and target, matching staff payment decisions.
            for (Payment payment : support.basePayments(candidate)) support.lock(Payment.class, payment.getId());
            BookingPackage pkg = candidate.getPackageId() == null ? null : support.lock(BookingPackage.class, candidate.getPackageId());
            Booking booking = support.booking(candidate.getId());
            if (booking.getStatus() == BookingStatus.CONFIRMED) {
                mark(booking, AffectedCause.COURT_DISABLED, null, actor, "Sân tạm ngưng hoạt động");
            } else if (unconfirmed(booking.getStatus())) {
                if (pkg == null) {
                    cancelUnconfirmed(booking, actor);
                    vouchers.restoreForFailedBooking(booking.getId());
                    points.restoreForFailedBooking(booking.getId());
                } else if (unconfirmed(pkg.getStatus())) {
                    // Một giao dịch trả cả đơn/gói: hủy toàn bộ đơn chưa xác nhận, trả ưu đãi đúng một lần.
                    pkg.setStatus(BookingStatus.CANCELLED_BY_FACILITY);
                    for (Long id : em.createQuery("select b.id from Booking b where b.packageId=:p order by b.id", Long.class)
                            .setParameter("p", pkg.getId()).getResultList()) cancelUnconfirmed(support.booking(id), actor);
                    em.flush();
                    vouchers.restoreForFailedPackage(pkg.getId());
                    points.restoreForFailedPackage(pkg.getId());
                }
            }
        }
    }
    private boolean unconfirmed(BookingStatus status) {
        return List.of(BookingStatus.HOLDING, BookingStatus.AWAITING_CONFIRMATION, BookingStatus.RESUBMIT_REQUESTED).contains(status);
    }
    private void cancelUnconfirmed(Booking booking, Long actor) {
        if (!unconfirmed(booking.getStatus())) return;
        for (Payment payment : support.basePayments(booking)) {
            if (payment.getStatus() == PaymentStatus.AWAITING_CONFIRMATION || payment.getStatus() == PaymentStatus.RESUBMIT_REQUESTED)
                payment.reject("Sân tạm ngưng hoạt động. Nếu đã chuyển tiền, vui lòng gửi khiếu nại để được hoàn tiền.");
        }
        cancelBooking(booking, actor, BookingStatus.CANCELLED_BY_FACILITY);
        em.flush();
    }
    public void hoursChanged(Long locationId,Long actor) {
        em.flush();
        for(Long id:em.createQuery("select b.id from Booking b where b.locationId=:l and b.status=:s order by b.id",Long.class)
                .setParameter("l",locationId).setParameter("s",BookingStatus.CONFIRMED).getResultList()) {
            Booking b=support.booking(id);
            if(availability.openingWindow(locationId,b.getPlayDate()).filter(w->w.covers(b.getStartMinute(),b.getEndMinute())).isEmpty())
                mark(b,AffectedCause.HOURS_CHANGED,null,actor,"Giờ mở cửa thay đổi");
        }
    }
}
