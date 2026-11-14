package com.sep490.bms.service.reschedule;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import com.sep490.bms.dto.request.RecordRefundRequest;
import com.sep490.bms.dto.response.RefundResponse;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.reschedule.RefundRequest;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.security.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tra cứu yêu cầu hoàn tiền, kiểm tra giới hạn và ghi nhận khoản Owner đã hoàn.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RefundService {
    private final EntityManager em;
    private final LocationAccessService access;
    private final BookingChangeSupport support;
    private final com.sep490.bms.service.promotion.LoyaltyPointService loyalty;

    @Transactional(readOnly = true)
    public List<RefundResponse> list(UserPrincipal user, RefundStatus status) {
        Long location = access.selectedLocation(user).getId();
        return em.createQuery("""
                select r, b.bookingCode from RefundRequest r join Booking b on b.id = r.bookingId
                where r.locationId = :location and (:status is null or r.status = :status)
                order by r.id desc
                """, Tuple.class)
                .setParameter("location", location)
                .setParameter("status", status)
                .getResultList().stream()
                .map(row -> new RefundResponse(row.get(0, RefundRequest.class), row.get(1, String.class), null))
                .toList();
    }
    @Transactional(readOnly = true)
    public RefundResponse detail(UserPrincipal user, Long id) {
        RefundRequest refund = findScoped(user, id);
        Booking booking = em.find(Booking.class, refund.getBookingId());
        BigDecimal remaining = refund.getStatus() == RefundStatus.PENDING_REFUND
                ? remainingRefundableAmount(refund, booking) : null;
        return new RefundResponse(refund, booking.getBookingCode(), remaining);
    }

    private RefundRequest findScoped(UserPrincipal u, Long id) {
        RefundRequest r=em.find(RefundRequest.class,id);
        if(r==null) throw new AppException("Không tìm thấy yêu cầu hoàn tiền",HttpStatus.NOT_FOUND);
        if(!access.selectedLocation(u).getId().equals(r.getLocationId())) throw new AppException("Sai địa điểm",HttpStatus.FORBIDDEN);
        return r;
    }
    public RefundResponse record(UserPrincipal u, Long id, RecordRefundRequest input) {
        RefundRequest observed = findScoped(u, id);
        Booking b=support.booking(observed.getBookingId()); // serialize cumulative refunds, including different complaint sources
        RefundRequest r=support.lock(RefundRequest.class,id);
        if(r.getStatus()!=RefundStatus.PENDING_REFUND) throw new AppException("Đã ghi nhận hoàn tiền",HttpStatus.CONFLICT);
        if (input.amount().compareTo(remainingRefundableAmount(r, b)) > 0) {
            throw fieldError("amount", "MSG70", "Số tiền hoàn vượt số tiền đã thu còn lại.");
        }
        String reason=input.reason()==null?null:input.reason().trim();
        if(input.amount().compareTo(r.getSuggestedAmount())!=0 && (reason==null || reason.isBlank()))
            throw fieldError("reason", "MSG71", "Số tiền hoàn khác số tiền gợi ý. Vui lòng nhập lý do.");
        if (input.refundDate().isBefore(r.getOriginalPaymentDate())) {
            throw fieldError("refundDate", "MSG02", "Ngày hoàn không được trước ngày thanh toán gốc.");
        }
        r.setRefundedAmount(input.amount());r.setRefundDate(input.refundDate());r.setReason(reason==null || reason.isBlank()?r.getReason():reason);
        r.setNote(input.note()==null?null:input.note().trim());r.setStatus(RefundStatus.REFUNDED);r.setRecordedBy(u.getId());r.setRecordedAt(LocalDateTime.now());
        em.flush(); loyalty.settleRefund(r.getId(),input.amount());
        support.notify(b.getPlayerId(),"REFUND_RECORDED","Chủ sân đã ghi nhận hoàn "+input.amount()+" đồng cho "+b.getBookingCode(),b.getId());
        return new RefundResponse(r, b.getBookingCode(), null);
    }

    private BigDecimal remainingRefundableAmount(RefundRequest refund, Booking booking) {
        BigDecimal refunded = em.createQuery("""
                select coalesce(sum(r.refundedAmount), 0) from RefundRequest r
                where r.bookingId = :bookingId and r.status = :status
                """, BigDecimal.class)
                .setParameter("bookingId", booking.getId())
                .setParameter("status", RefundStatus.REFUNDED)
                .getSingleResult();
        BigDecimal collected = refund.getVerifiedUnrecordedAmount() != null
                ? refund.getVerifiedUnrecordedAmount() : support.refundableAmount(booking);
        return collected.subtract(refunded).max(BigDecimal.ZERO);
    }

    private AppException fieldError(String field, String code, String message) {
        String text = message + " (" + code + ")";
        return new AppException(text, HttpStatus.BAD_REQUEST, Map.of("code", code, field, text));
    }
}
