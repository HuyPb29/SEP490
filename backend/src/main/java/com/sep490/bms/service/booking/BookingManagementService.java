package com.sep490.bms.service.booking;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.request.WalkInBookingRequest;
import com.sep490.bms.dto.payment.ConfirmPaymentRequest;
import com.sep490.bms.entity.*;
import com.sep490.bms.entity.booking.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.security.*;
import jakarta.persistence.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** UC16 and the booking reads needed by UC21–23. */
@Service @RequiredArgsConstructor @Transactional
public class BookingManagementService {
    private final EntityManager em;
    private final LocationAccessService scope;
    private final SlotAvailabilityService availability;
    private final PriceCalculator prices;
    private final BookingCodeGenerator codes;

    public Booking createWalkIn(UserPrincipal staff,WalkInBookingRequest request) {
        Location location=scope.selectedLocation(staff);
        Court court=em.find(Court.class,request.courtId(),LockModeType.PESSIMISTIC_WRITE);
        if(court==null || !court.isActive() || !court.getLocationId().equals(location.getId())) throw new AppException("Sân không thuộc địa điểm đang chọn");
        if(!request.date().atStartOfDay().plusMinutes(request.startMinute()).isAfter(LocalDateTime.now()) || request.date().isAfter(LocalDate.now().plusDays(location.getAdvanceBookingDays()))) throw new AppException("Buổi ngoài hạn đặt trước");
        if(availability.findProblem(location.getId(),court.getId(),request.date(),request.startMinute(),request.endMinute()).isPresent()) throw new AppException("Slot không còn trống (MSG28)",HttpStatus.CONFLICT);
        var blocks=prices.rangePrices(court.getId(),request.date(),request.startMinute(),request.endMinute());
        BigDecimal total=blocks.values().stream().reduce(BigDecimal.ZERO,BigDecimal::add);
        LocalDateTime now=LocalDateTime.now().withNano(0);
        Booking b=Booking.builder().bookingCode(codes.next()).bookingType(BookingType.WALK_IN).locationId(location.getId()).courtId(court.getId())
                .staffId(staff.getId()).customerName(request.customerName().trim()).customerPhone(request.customerPhone()).note(request.note())
                .playDate(request.date()).startMinute(request.startMinute()).endMinute(request.endMinute()).listAmount(total).finalAmount(total)
                .holdExpiresAt(now.plusMinutes(5)).createdAt(now).build();
        em.persist(b);em.flush();
        for(var block:blocks.entrySet()) em.persist(BookingSlot.builder().bookingId(b.getId()).courtId(b.getCourtId()).slotDate(b.getPlayDate()).slotStartMinute(block.getKey()).price(block.getValue()).build());
        em.flush();return b;
    }
    public Booking confirmWalkIn(UserPrincipal staff,Long id,ConfirmPaymentRequest request) {
        Location location=scope.selectedLocation(staff);Booking b=em.find(Booking.class,id,LockModeType.PESSIMISTIC_WRITE);
        if(b==null) throw new AppException("Không tìm thấy booking",HttpStatus.NOT_FOUND);
        em.refresh(b,LockModeType.PESSIMISTIC_WRITE);
        if(!b.getLocationId().equals(location.getId())) throw new AppException("Sai địa điểm",HttpStatus.FORBIDDEN);
        if(b.getBookingType()!=BookingType.WALK_IN || b.getStatus()!=BookingStatus.HOLDING || !b.getHoldExpiresAt().isAfter(LocalDateTime.now())) throw new AppException("Booking không còn giữ chỗ",HttpStatus.CONFLICT);
        BigDecimal received=request==null || request.receivedAmount()==null?b.getFinalAmount():request.receivedAmount();
        if(received.compareTo(b.getFinalAmount())<0) throw new AppException("Chưa nhận đủ tiền");
        Payment payment=Payment.builder().locationId(b.getLocationId()).bookingId(id).amountDue(b.getFinalAmount()).build();em.persist(payment);em.flush();
        payment.confirm(staff.getId(),received,"WI"+payment.getId(),LocalDateTime.now());b.setStatus(BookingStatus.CONFIRMED);b.setUpdatedAt(LocalDateTime.now());
        return b;
    }
    @Transactional(readOnly=true)
    public Booking detail(UserPrincipal user,Long id) {
        Booking b=em.find(Booking.class,id);
        if(b==null) throw new AppException("Không tìm thấy booking",HttpStatus.NOT_FOUND);
        if(user.getRole()==Role.PLAYER) { if(!user.getId().equals(b.getPlayerId())) throw new AppException("Không có quyền",HttpStatus.FORBIDDEN); }
        else if((user.getRole()!=Role.STAFF && user.getRole()!=Role.OWNER) || !scope.selectedLocation(user).getId().equals(b.getLocationId())) throw new AppException("Không có quyền",HttpStatus.FORBIDDEN);
        return b;
    }
    @Transactional(readOnly=true)
    public PageResponse<Booking> list(UserPrincipal user,boolean staff,BookingStatus status,LocalDate from,LocalDate to,int page,int size) {
        if(page<0 || size<1 || size>100 || from!=null && to!=null && from.isAfter(to)) throw new AppException("Bộ lọc không hợp lệ");
        Long scopeId=staff?scope.selectedLocation(user).getId():user.getId();
        String filter=staff?"b.locationId=:scope":"b.playerId=:scope";
        String where=" where "+filter+" and (:status is null or b.status=:status) and (:from is null or b.playDate>=:from) and (:to is null or b.playDate<=:to)";
        var query=em.createQuery("select b from Booking b"+where+" order by b.playDate desc,b.startMinute desc,b.id desc",Booking.class)
                .setParameter("scope",scopeId).setParameter("status",status).setParameter("from",from).setParameter("to",to);
        long count=em.createQuery("select count(b) from Booking b"+where,Long.class).setParameter("scope",scopeId).setParameter("status",status).setParameter("from",from).setParameter("to",to).getSingleResult();
        List<Booking> result=query.setFirstResult(Math.multiplyExact(page,size)).setMaxResults(size).getResultList();
        return PageResponse.from(new PageImpl<>(result,PageRequest.of(page,size),count));
    }
}
