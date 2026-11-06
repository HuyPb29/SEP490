package com.sep490.bms.service.payment;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import com.sep490.bms.dto.payment.*;
import com.sep490.bms.entity.*;
import com.sep490.bms.entity.booking.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.payment.*;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.entity.notification.Notification;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.security.*;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.promotion.*;
import jakarta.persistence.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** UC18/19 package payment: one payment and one atomic decision for all sessions. */
@Service @RequiredArgsConstructor @Transactional
public class PackagePaymentService {
    private final EntityManager em;
    private final LocationAccessService scope;
    private final FileStorageService storage;
    private final LoyaltyPointService points;
    private final VoucherService vouchers;
    public record Instructions(Long packageId,BigDecimal amountDue,String transferContent,String bankName,String bankAccountNo,
            String bankAccountHolder,String qrImageUrl,LocalDateTime holdExpiresAt) {}
    private BookingPackage pkg(Long id,boolean lock) {
        BookingPackage p=em.find(BookingPackage.class,id);
        if(p==null) throw new AppException("Không tìm thấy gói",HttpStatus.NOT_FOUND);
        if(lock) { em.flush();em.refresh(p,LockModeType.PESSIMISTIC_WRITE); }
        return p;
    }
    private List<Booking> children(Long id) {
        return em.createQuery("select b from Booking b where b.packageId=:p order by b.id",Booking.class).setParameter("p",id).getResultList();
    }
    private void authorize(UserPrincipal u,BookingPackage p) {
        if(u.getRole()==Role.PLAYER) { if(!p.getPlayerId().equals(u.getId())) throw new AppException("Không có quyền",HttpStatus.FORBIDDEN); }
        else if(!scope.selectedLocation(u).getId().equals(p.getLocationId())) throw new AppException("Sai địa điểm",HttpStatus.FORBIDDEN);
    }
    @Transactional(readOnly=true)
    public Instructions instructions(UserPrincipal u,Long id) {
        BookingPackage p=pkg(id,false);authorize(u,p);
        if(p.getStatus()!=BookingStatus.HOLDING && p.getStatus()!=BookingStatus.RESUBMIT_REQUESTED) throw new AppException("Gói không chờ chuyển khoản",HttpStatus.CONFLICT);
        if(p.getStatus()==BookingStatus.HOLDING && !p.getHoldExpiresAt().isAfter(LocalDateTime.now())) throw new AppException("Gói hết hạn giữ chỗ",HttpStatus.CONFLICT);
        Location l=em.find(Location.class,p.getLocationId());
        return new Instructions(id,p.getFinalAmount(),"BCMS PKG"+id,l.getBankName(),l.getBankAccountNo(),l.getBankAccountHolder(),
                l.getQrImagePath()==null?null:"/api/booking-packages/"+id+"/payment-instructions/qr",p.getHoldExpiresAt());
    }
    public org.springframework.core.io.Resource qr(UserPrincipal u,Long id) {
        instructions(u,id);String path=em.find(Location.class,pkg(id,false).getLocationId()).getQrImagePath();
        if(path==null) throw new AppException("Chưa có QR",HttpStatus.NOT_FOUND);return storage.load(path);
    }
    public PaymentResponse submit(UserPrincipal u,Long id,MultipartFile proof) {
        BookingPackage p=pkg(id,true);authorize(u,p);
        if(p.getStatus()!=BookingStatus.HOLDING || !p.getHoldExpiresAt().isAfter(LocalDateTime.now())) throw new AppException("Gói không còn giữ chỗ",HttpStatus.CONFLICT);
        if(proof==null || proof.isEmpty()) throw new AppException("Cần ảnh chứng từ (MSG106)");
        Payment payment=Payment.builder().locationId(p.getLocationId()).packageId(id).amountDue(p.getFinalAmount()).submittedAt(LocalDateTime.now()).build();
        em.persist(payment);em.flush();saveProof(payment,proof);status(p,BookingStatus.AWAITING_CONFIRMATION);
        return PaymentResponse.fromPackage(payment);
    }
    private Payment payment(UserPrincipal u,Long id) {
        Payment observed=em.find(Payment.class,id);
        if(observed==null || observed.getPackageId()==null) throw new AppException("Không tìm thấy thanh toán gói",HttpStatus.NOT_FOUND);
        BookingPackage p=pkg(observed.getPackageId(),true);authorize(u,p);
        em.refresh(observed,LockModeType.PESSIMISTIC_WRITE);return observed;
    }
    @Transactional(readOnly=true)
    public PaymentResponse detail(UserPrincipal u,Payment payment) { authorize(u,pkg(payment.getPackageId(),false));return PaymentResponse.fromPackage(payment); }
    @Transactional(readOnly=true)
    public PaymentDetailResponse staffDetail(UserPrincipal u,Payment payment) {
        BookingPackage p=pkg(payment.getPackageId(),false);authorize(u,p);Account customer=em.find(Account.class,p.getPlayerId());
        return PaymentDetailResponse.builder().payment(PaymentResponse.fromPackage(payment)).customerName(customer.getFullName()).customerPhone(customer.getPhone())
                .sessions(children(p.getId())).proofs(em.createQuery("select proof from PaymentProof proof where proof.paymentId=:p order by proof.id desc",PaymentProof.class)
                        .setParameter("p",payment.getId()).getResultList().stream().map(proof->PaymentDetailResponse.Proof.builder().id(proof.getId()).uploadedAt(proof.getUploadedAt())
                                .imageUrl("/api/payments/"+payment.getId()+"/proofs/"+proof.getId()+"/image").build()).toList()).build();
    }
    public PaymentResponse confirm(UserPrincipal u,Long id,ConfirmPaymentRequest input) {
        Payment payment=payment(u,id);BookingPackage p=pkg(payment.getPackageId(),false);pending(payment,p);
        BigDecimal received=input==null || input.receivedAmount()==null?payment.getAmountDue():input.receivedAmount();
        if(received.compareTo(payment.getAmountDue())<0) throw new AppException("Chưa nhận đủ tiền");
        payment.confirm(u.getId(),received,"PK"+payment.getId(),LocalDateTime.now());status(p,BookingStatus.CONFIRMED);em.flush();
        points.accrueForConfirmedPayment(id);batchReward(p);notify(p.getPlayerId(),"PAYMENT_CONFIRMED","Thanh toán gói đã xác nhận",p.getId());
        if(received.compareTo(payment.getAmountDue())>0) notify(em.find(Location.class,p.getLocationId()).getOwnerId(),"PAYMENT_OVERPAID","Gói có tiền chuyển thừa",p.getId());
        return PaymentResponse.fromPackage(payment);
    }
    public PaymentResponse requestResubmission(UserPrincipal u,Long id,ResubmitRequest input) {
        Payment payment=payment(u,id);BookingPackage p=pkg(payment.getPackageId(),false);pending(payment,p);
        if(input.playerAtFault() && payment.noResubmitLeft()) { fail(payment,p,"Hết lượt bổ sung");return PaymentResponse.fromPackage(payment); }
        payment.requestResubmission(input.reason().trim(),deadline(p),input.playerAtFault());status(p,BookingStatus.RESUBMIT_REQUESTED);
        notify(p.getPlayerId(),"PAYMENT_RESUBMIT_REQUESTED",input.reason(),p.getId());return PaymentResponse.fromPackage(payment);
    }
    public PaymentResponse resubmit(UserPrincipal u,Long id,MultipartFile proof) {
        Payment payment=payment(u,id);BookingPackage p=pkg(payment.getPackageId(),false);
        if(payment.getStatus()!=PaymentStatus.RESUBMIT_REQUESTED || p.getStatus()!=BookingStatus.RESUBMIT_REQUESTED || !deadline(p).isAfter(LocalDateTime.now())) throw new AppException("Không còn hạn bổ sung",HttpStatus.CONFLICT);
        if(proof==null || proof.isEmpty()) throw new AppException("Cần ảnh chứng từ (MSG106)");
        saveProof(payment,proof);payment.resubmitted(LocalDateTime.now());status(p,BookingStatus.AWAITING_CONFIRMATION);return PaymentResponse.fromPackage(payment);
    }
    public PaymentResponse reject(UserPrincipal u,Long id,String reason) {
        Payment payment=payment(u,id);BookingPackage p=pkg(payment.getPackageId(),false);
        if(payment.getStatus()!=PaymentStatus.AWAITING_CONFIRMATION) throw new AppException("Thanh toán đã xử lý",HttpStatus.CONFLICT);
        fail(payment,p,reason);return PaymentResponse.fromPackage(payment);
    }
    private void pending(Payment payment,BookingPackage p) {
        if(payment.getStatus()!=PaymentStatus.AWAITING_CONFIRMATION || p.getStatus()!=BookingStatus.AWAITING_CONFIRMATION || !deadline(p).isAfter(LocalDateTime.now())) throw new AppException("Thanh toán đã xử lý hoặc quá hạn",HttpStatus.CONFLICT);
    }
    private LocalDateTime deadline(BookingPackage p) {
        return children(p.getId()).stream().map(b->b.getPlayDate().atStartOfDay().plusMinutes(b.getEndMinute())).min(LocalDateTime::compareTo).orElseThrow();
    }
    private void saveProof(Payment p,MultipartFile proof) { em.persist(PaymentProof.builder().paymentId(p.getId()).imagePath(storage.storeImage(proof,"payment-proofs")).build()); }
    private void status(BookingPackage p,BookingStatus status) {
        p.setStatus(status);for(Booking b:children(p.getId())) { em.refresh(b,LockModeType.PESSIMISTIC_WRITE);b.setStatus(status);b.setUpdatedAt(LocalDateTime.now()); }
    }
    private void fail(Payment payment,BookingPackage p,String reason) {
        payment.reject(reason);status(p,BookingStatus.PAYMENT_REJECTED);release(p);em.flush();
        vouchers.restoreForFailedPackage(p.getId());points.restoreForFailedPackage(p.getId());notify(p.getPlayerId(),"PAYMENT_REJECTED",reason,p.getId());
    }
    private void release(BookingPackage p) {
        em.createQuery("update BookingSlot s set s.active=false where s.bookingId in (select b.id from Booking b where b.packageId=:p)").setParameter("p",p.getId()).executeUpdate();
    }
    public void expire(Long id) {
        BookingPackage p=pkg(id,true);LocalDateTime now=LocalDateTime.now();
        if(p.getStatus()==BookingStatus.HOLDING && !p.getHoldExpiresAt().isAfter(now)) {
            status(p,BookingStatus.EXPIRED);release(p);em.flush();vouchers.restoreForFailedPackage(id);points.restoreForFailedPackage(id);notify(p.getPlayerId(),"BOOKING_EXPIRED","Gói hết hạn giữ chỗ",id);
        } else if((p.getStatus()==BookingStatus.AWAITING_CONFIRMATION || p.getStatus()==BookingStatus.RESUBMIT_REQUESTED) && !deadline(p).isAfter(now)) {
            Payment payment=em.createQuery("select pay from Payment pay where pay.packageId=:p",Payment.class).setParameter("p",id).setLockMode(LockModeType.PESSIMISTIC_WRITE).getSingleResult();
            fail(payment,p,"Quá hạn xác nhận thanh toán gói");
        }
    }
    private void batchReward(BookingPackage p) {
        if(p.getBatchOfferId()==null) return;
        BatchOffer offer=em.find(BatchOffer.class,p.getBatchOfferId());
        if(offer==null || p.getFinalAmount().compareTo(offer.getMinPackageAmount())<0) return;
        Voucher voucher=em.find(Voucher.class,offer.getVoucherId(),LockModeType.PESSIMISTIC_WRITE);
        if(voucher==null || voucher.getStatus()!=VoucherStatus.PUBLISHED) return;
        em.persist(VoucherGrant.builder().voucherId(voucher.getId()).playerId(p.getPlayerId())
                .expiresAt(voucher.getGrantValidDays()==null?null:LocalDateTime.now().plusDays(voucher.getGrantValidDays())).note("Batch offer, package #"+p.getId()).build());
    }
    private void notify(Long user,String type,String content,Long id) {
        em.persist(Notification.builder().recipientId(user).type(type).title("Thanh toán gói").content(content).refType("PACKAGE").refId(id).build());
    }
}
