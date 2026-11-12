package com.sep490.bms.service.reschedule;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import com.sep490.bms.dto.request.RecordRefundRequest;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.reschedule.RefundRequest;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.security.*;
import jakarta.persistence.EntityManager;
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

    public List<RefundRequest> list(UserPrincipal u,RefundStatus status) {
        Long location=access.selectedLocation(u).getId();
        return em.createQuery("select r from RefundRequest r where r.locationId=:l and (:s is null or r.status=:s) order by r.id desc",RefundRequest.class)
                .setParameter("l",location).setParameter("s",status).getResultList();
    }
    public RefundRequest detail(UserPrincipal u,Long id) {
        RefundRequest r=em.find(RefundRequest.class,id);
        if(r==null) throw new AppException("Không tìm thấy yêu cầu hoàn tiền",HttpStatus.NOT_FOUND);
        if(!access.selectedLocation(u).getId().equals(r.getLocationId())) throw new AppException("Sai địa điểm",HttpStatus.FORBIDDEN);
        return r;
    }
    public RefundRequest record(UserPrincipal u,Long id,RecordRefundRequest input) {
        RefundRequest observed=detail(u,id);
        Booking b=support.booking(observed.getBookingId()); // serialize cumulative refunds, including different complaint sources
        RefundRequest r=support.lock(RefundRequest.class,id);
        if(r.getStatus()!=RefundStatus.PENDING_REFUND) throw new AppException("Đã ghi nhận hoàn tiền",HttpStatus.CONFLICT);
        BigDecimal refunded=em.createQuery("select coalesce(sum(r.refundedAmount),0) from RefundRequest r where r.bookingId=:b and r.status=:s",BigDecimal.class)
                .setParameter("b",b.getId()).setParameter("s",RefundStatus.REFUNDED).getSingleResult();
        BigDecimal cap = r.getVerifiedUnrecordedAmount() != null
                ? r.getVerifiedUnrecordedAmount() : support.refundableAmount(b);
        if(input.amount().compareTo(cap.subtract(refunded))>0) throw new AppException("Số tiền hoàn vượt số tiền đã thu còn lại");
        String reason=input.reason()==null?null:input.reason().trim();
        if(input.amount().compareTo(r.getSuggestedAmount())!=0 && (reason==null || reason.isBlank()))
            throw new AppException("Số tiền khác đề xuất phải có lý do");
        if(input.refundDate().isBefore(r.getOriginalPaymentDate())) throw new AppException("Ngày hoàn không được trước ngày thanh toán");
        r.setRefundedAmount(input.amount());r.setRefundDate(input.refundDate());r.setReason(reason==null || reason.isBlank()?r.getReason():reason);
        r.setNote(input.note()==null?null:input.note().trim());r.setStatus(RefundStatus.REFUNDED);r.setRecordedBy(u.getId());r.setRecordedAt(LocalDateTime.now());
        em.flush(); loyalty.settleRefund(r.getId(),input.amount());
        support.notify(b.getPlayerId(),"REFUND_RECORDED","Chủ sân đã ghi nhận hoàn "+input.amount()+" đồng cho "+b.getBookingCode(),b.getId());
        return r;
    }
}
