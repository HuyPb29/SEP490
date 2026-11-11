package com.sep490.bms.service.reschedule;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.booking.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.notification.Notification;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.team.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.security.UserPrincipal;
import jakarta.persistence.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Shared helpers are called only inside the workflow transaction. Lock booking before its children. */
@Component
@RequiredArgsConstructor
public class BookingChangeSupport {
    private final EntityManager em;

    public <T> T lock(Class<T> type, Long id) {
        if (id == null || id <= 0) throw new AppException("Mã không hợp lệ");
        em.flush();
        T value = em.find(type, id, LockModeType.PESSIMISTIC_WRITE);
        if (value == null) throw new AppException("Không tìm thấy dữ liệu", HttpStatus.NOT_FOUND);
        em.refresh(value, LockModeType.PESSIMISTIC_WRITE);
        return value;
    }
    public Booking booking(Long id) { return lock(Booking.class, id); }
    public void player(UserPrincipal user, Booking b) {
        if (user == null || user.getRole() != Role.PLAYER || !user.getId().equals(b.getPlayerId()))
            throw new AppException("Không có quyền với booking", HttpStatus.FORBIDDEN);
    }
    public LocalDateTime start(Booking b) { return b.getPlayDate().atStartOfDay().plusMinutes(b.getStartMinute()); }
    public void confirmed(Booking b) {
        if (b.getStatus() != BookingStatus.CONFIRMED || !start(b).isAfter(LocalDateTime.now()))
            throw new AppException("Booking phải được xác nhận và chưa đến giờ chơi", HttpStatus.CONFLICT);
    }
    public List<Payment> basePayments(Booking b) {
        return em.createQuery("select p from Payment p where p.bookingId=:id or (:pkg is not null and p.packageId=:pkg)", Payment.class)
                .setParameter("id", b.getId()).setParameter("pkg", b.getPackageId()).getResultList();
    }
    public void paid(Booking b) {
        if (basePayments(b).stream().noneMatch(p -> p.getStatus() == PaymentStatus.CONFIRMED))
            throw new AppException("Booking chưa có thanh toán xác nhận", HttpStatus.CONFLICT);
    }
    public BigDecimal paidAmount(Booking b) {
        BigDecimal extra = em.createQuery("select coalesce(sum(p.amountDue),0) from Payment p where p.status=:s and p.rescheduleRequestId in (select r.id from RescheduleRequest r where r.bookingId=:id)", BigDecimal.class)
                .setParameter("s", PaymentStatus.CONFIRMED).setParameter("id", b.getId()).getSingleResult();
        return b.getFinalAmount().add(extra);
    }
    public BigDecimal refundableAmount(Booking b) {
        BigDecimal collected=basePayments(b).stream().map(p->p.getReceivedAmount()!=null?p.getReceivedAmount():
                p.getStatus()==PaymentStatus.CONFIRMED?p.getAmountDue():BigDecimal.ZERO).reduce(BigDecimal.ZERO,BigDecimal::add);
        return paidAmount(b).subtract(b.getFinalAmount()).add(b.getFinalAmount().min(collected));
    }
    public LocalDate originalPaymentDate(Booking b) {
        return basePayments(b).stream().filter(p->p.getConfirmedAt()!=null)
                .map(p->p.getConfirmedAt().toLocalDate()).min(LocalDate::compareTo)
                .orElseThrow(()->new AppException("Chưa có ngày thanh toán gốc được xác nhận"));
    }
    public void release(Long bookingId, Long requestId) {
        List<BookingSlot> slots = em.createQuery("select s from BookingSlot s where s.bookingId=:id and s.active=true", BookingSlot.class)
                .setParameter("id", bookingId).getResultList();
        for (BookingSlot s : slots) if (requestId == null || requestId.equals(s.getRescheduleRequestId())) s.setActive(false);
        em.flush(); // filtered unique slot index must see releases before inserting/promoting new slots
    }
    public void notify(Long recipient, String type, String content, Long bookingId) {
        if (recipient != null) em.persist(Notification.builder().recipientId(recipient).type(type)
                .title("Cập nhật booking").content(content.length()>500?content.substring(0,500):content).refType("BOOKING").refId(bookingId).build());
    }
    public void expireMatches(Booking b) {
        var matches = em.createQuery("select m from Match m where m.bookingId=:id and m.status in :states", Match.class)
                .setParameter("id", b.getId()).setParameter("states", List.of(MatchStatus.OPEN, MatchStatus.CLOSED))
                .setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        for (Match m : matches) {
            m.setReschedulePending(false);
            m.setStatus(MatchStatus.EXPIRED);
            m.setClosedAt(LocalDateTime.now());
            for (var r : em.createQuery("select r from MatchJoinRequest r where r.matchId=:id", MatchJoinRequest.class)
                    .setParameter("id", m.getId()).getResultList()) {
                if (r.getStatus() == JoinRequestStatus.PENDING) {
                    r.setStatus(JoinRequestStatus.CANCELLED); r.setDecidedAt(LocalDateTime.now());
                }
                if (r.getStatus() == JoinRequestStatus.APPROVED || r.getStatus() == JoinRequestStatus.CANCELLED)
                    notify(r.getPlayerId(), "MATCH_BOOKING_CHANGED", "Kèo hết hiệu lực do booking bị hủy", b.getId());
            }
            notify(b.getPlayerId(), "MATCH_BOOKING_CHANGED", "Kèo đã hết hiệu lực", b.getId());
        }
    }
}
