package com.sep490.bms.service.promotion;

import java.math.*;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.validation.annotation.Validated;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.booking.*;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.reschedule.*;
import com.sep490.bms.entity.notification.Notification;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.promotion.*;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.security.*;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Quản lý số dư và lịch sử điểm, xử lý tích, dùng, trả lại và thu hồi điểm theo giao dịch.
 */
@Service @Validated @RequiredArgsConstructor @Transactional(readOnly=true)
public class LoyaltyPointService {
    public static final int POINT_VALUE=500;
    public static final int EARNING_RATE=10000;
    /** Trần khi không dùng voucher. Voucher áp dụng tỷ lệ của chiến dịch theo UC24. */
    public static final int MAX_POINT_PERCENT=50;
    private final PlayerLocationBalanceRepository balances;
    private final PointTransactionRepository transactions;
    private final LoyaltyAccrualRepository accruals;
    private final VoucherUsageRepository usages;
    private final LoyaltyMilestoneService milestones;
    private final LocationAccessService scope;
    private final EntityManager em;
    private final AccountRepository accounts;
    private final BookingRepository bookings;

    private Pageable page(int page,int size) {
        return lookupPage(page,size).withSort(Sort.by(Sort.Direction.DESC,"id"));
    }
    private PageRequest lookupPage(int page,int size) {
        if(page<0 || size<1 || size>100) throw new AppException("Phân trang không hợp lệ");
        return PageRequest.of(page,size);
    }
    private void role(UserPrincipal u,Role r) {
        if(u==null || u.getRole()!=r) throw new AppException("Không có quyền thực hiện",HttpStatus.FORBIDDEN);
    }
    public PageResponse<LoyaltyBalanceResponse> balances(UserPrincipal u,int page,int size) {
        role(u,Role.PLAYER);
        return PageResponse.from(balances.findByPlayerId(u.getId(),page(page,size)).map(LoyaltyBalanceResponse::from));
    }
    public PageResponse<PointTransactionResponse> history(UserPrincipal u,Long locationId,PointTransactionType type,int page,int size) {
        role(u,Role.PLAYER);
        return PageResponse.from(transactions.findAll((r,q,c) -> {
            var sub=q.subquery(Long.class); var b=sub.from(PlayerLocationBalance.class);
            sub.select(b.get("id")).where(c.equal(b.get("playerId"),u.getId()),
                    locationId==null ? c.conjunction():c.equal(b.get("locationId"),locationId));
            return c.and(r.get("balanceId").in(sub),type==null ? c.conjunction():c.equal(r.get("type"),type));
        },page(page,size)).map(PointTransactionResponse::from));
    }
    public PageResponse<PointGrantPlayerResponse> pointGrantPlayers(UserPrincipal user,String query,int page,int size) {
        role(user,Role.OWNER);
        return PageResponse.from(accounts.findPointGrantPlayers(
                scope.selectedLocation(user).getId(),pointGrantQuery(query),lookupPage(page,size)));
    }
    public PageResponse<PointGrantBookingResponse> pointGrantBookings(UserPrincipal user,Long playerId,String query,int page,int size) {
        role(user,Role.OWNER);
        return PageResponse.from(bookings.findPointGrantBookings(
                scope.selectedLocation(user).getId(),playerId,pointGrantQuery(query),lookupPage(page,size)));
    }
    private String pointGrantQuery(String query) {
        String value=query.strip();
        if(value.length()>100) throw new AppException("Từ khóa tìm kiếm tối đa 100 ký tự");
        return value;
    }
    private <T> T lock(Class<T> type,Long id) {
        em.flush(); // Preserve target state changed earlier in this transaction.
        T t=id==null ? null:em.find(type,id,LockModeType.PESSIMISTIC_WRITE);
        if(t==null) throw new AppException("Không tìm thấy dữ liệu",HttpStatus.NOT_FOUND);
        em.refresh(t,LockModeType.PESSIMISTIC_WRITE);
        return t;
    }
    /** Serializes initial balance creation and concurrent spends, including when no balance row exists yet. */
    private PlayerLocationBalance balance(Long player,Long location,boolean requireActive) {
        Location l=lock(Location.class,location);
        Account a=lock(Account.class,player);
        if(a.getRole()!=Role.PLAYER || requireActive && (a.getStatus()!=AccountStatus.ACTIVE || !"ACTIVE".equals(l.getStatus())))
            throw new AppException("Player hoặc địa điểm không hoạt động");
        PlayerLocationBalance b=balances.findByPlayerIdAndLocationId(player,location).orElse(null);
        if(b==null) return balances.saveAndFlush(PlayerLocationBalance.builder().playerId(player).locationId(location).build());
        em.refresh(b,LockModeType.PESSIMISTIC_WRITE); return b;
    }
    private PointTransaction change(PlayerLocationBalance b,Long booking,Long pkg,PointTransactionType type,int delta,Integer rate,String reason,Long actor) {
        long after=(long)b.getPointBalance()+delta;
        if(after<0 || after>Integer.MAX_VALUE) throw new AppException("Số dư điểm không hợp lệ",HttpStatus.CONFLICT);
        if(delta==0) throw new IllegalArgumentException("Zero-value entries are not ledger transactions");
        b.setPointBalance((int)after); b.setUpdatedAt(LocalDateTime.now());
        return transactions.saveAndFlush(PointTransaction.builder().balanceId(b.getId()).bookingId(booking).packageId(pkg)
                .type(type).points(delta).balanceAfter((int)after).earningRate(rate).reason(reason).createdBy(actor).build());
    }
    @Transactional
    public PointTransactionResponse adjust(UserPrincipal u,@Valid LoyaltyAdjustmentRequest r) {
        role(u,Role.OWNER); Long location=scope.selectedLocation(u).getId();
        Booking b=lock(Booking.class,r.bookingId());
        if(!location.equals(b.getLocationId())) throw new AppException("Booking không thuộc địa điểm đã chọn",HttpStatus.FORBIDDEN);
        if(b.getPlayerId()==null || b.getBookingType()==BookingType.WALK_IN) throw new AppException("Booking không có Player nhận điểm");
        if(r.playerId()!=null && !r.playerId().equals(b.getPlayerId())) {
            String message="Booking không thuộc Player đã chọn. (MSG02)";
            throw new AppException(message,HttpStatus.BAD_REQUEST,Map.of("bookingId",message));
        }
        PlayerLocationBalance balance=balance(b.getPlayerId(),location,true);
        return PointTransactionResponse.from(change(balance,b.getId(),null,PointTransactionType.ADJUST,r.points(),null,r.reason().trim(),u.getId()));
    }
    private Optional<PointTransaction> previous(Long booking,Long pkg,PointTransactionType type) {
        return booking!=null ? transactions.findFirstByBookingIdAndTypeOrderByIdAsc(booking,type)
                :transactions.findFirstByPackageIdAndTypeOrderByIdAsc(pkg,type);
    }
    /** Preview is pure: no balance creation or reservation. F3 calls redeem only after confirmation. */
    public BigDecimal preview(Long player,Long location,BigDecimal afterVoucher,int points) {
        return preview(player,location,afterVoucher,points,MAX_POINT_PERCENT);
    }
    public BigDecimal preview(Long player,Long location,BigDecimal afterVoucher,int points,int maxPointPercent) {
        if (maxPointPercent == 0) throw new AppException("Voucher này không dùng cùng điểm. (MSG40)");
        int available=balances.findByPlayerIdAndLocationId(player,location).map(PlayerLocationBalance::getPointBalance).orElse(0);
        if(points<2 || points>available) throw new AppException("Mỗi lần dùng điểm phải giảm ít nhất 1.000 đồng và không vượt số dư. (MSG37)");
        BigDecimal discount=BigDecimal.valueOf(points).multiply(BigDecimal.valueOf(POINT_VALUE));
        BigDecimal max=afterVoucher.multiply(BigDecimal.valueOf(maxPointPercent))
                .divide(BigDecimal.valueOf(100),0,RoundingMode.DOWN).min(afterVoucher.subtract(BigDecimal.ONE)).max(BigDecimal.ZERO);
        if(discount.compareTo(max)>0) throw new AppException("Bạn được dùng tối đa "+max.divideToIntegralValue(BigDecimal.valueOf(POINT_VALUE)).toBigInteger()+" điểm cho khoản thanh toán này. (MSG38)");
        return discount;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public BigDecimal redeemForBooking(Long id,int points) {
        Booking b=lock(Booking.class,id);
        if(b.getBookingType()!=BookingType.SINGLE || b.getPackageId()!=null || b.getPlayerId()==null) throw new AppException("MSG40: Booking không thể dùng điểm");
        holding(b.getStatus(),b.getHoldExpiresAt());
        BigDecimal discount=redeem(b.getId(),null,b.getPlayerId(),b.getLocationId(),b.getListAmount().subtract(b.getVoucherDiscount()),points,b.getVoucherDiscount());
        b.setPointsUsed(points); b.setPointDiscount(discount); b.setFinalAmount(b.getListAmount().subtract(b.getVoucherDiscount()).subtract(discount));
        return discount;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public BigDecimal redeemForPackage(Long id,int points) {
        BookingPackage p=lock(BookingPackage.class,id); holding(p.getStatus(),p.getHoldExpiresAt());
        // F3 persists finalAmount after bulk discount and voucher, before applying points (BR28/41).
        BigDecimal afterVoucher=p.getFinalAmount().add(p.getPointDiscount());
        BigDecimal discount=redeem(null,p.getId(),p.getPlayerId(),p.getLocationId(),afterVoucher,points,p.getVoucherDiscount());
        p.setPointsUsed(points); p.setPointDiscount(discount); p.setFinalAmount(afterVoucher.subtract(discount));
        return discount;
    }
    private void holding(BookingStatus status,LocalDateTime expiry) {
        if(status!=BookingStatus.HOLDING || expiry==null || !expiry.isAfter(LocalDateTime.now())) throw new AppException("Đơn không còn giữ chỗ");
    }
    private BigDecimal redeem(Long booking,Long pkg,Long player,Long location,BigDecimal amount,int points,BigDecimal voucherDiscount) {
        var old=previous(booking,pkg,PointTransactionType.REDEEM);
        if(old.isPresent()) {
            if(old.get().getPoints()!=-points || previous(booking,pkg,PointTransactionType.RETURN).isPresent()) throw new AppException("Đơn đã có lịch sử dùng điểm",HttpStatus.CONFLICT);
            return BigDecimal.valueOf(points).multiply(BigDecimal.valueOf(POINT_VALUE));
        }
        var usage=booking!=null ? usages.findByBookingId(booking):usages.findByPackageId(pkg);
        if(voucherDiscount.signum()>0 && usage.isEmpty()) throw new AppException("Thiếu lịch sử voucher",HttpStatus.CONFLICT);
        int cap=MAX_POINT_PERCENT;
        if (usage.isPresent()) {
            Voucher voucher=em.find(Voucher.class,usage.get().getVoucherId(),LockModeType.PESSIMISTIC_READ);
            if (voucher==null) throw new AppException("Thiếu voucher đã áp dụng",HttpStatus.CONFLICT);
            cap=voucher.isAllowPoints() ? voucher.getMaxPointPercent() : 0;
        }
        PlayerLocationBalance b=balance(player,location,true);
        BigDecimal discount=preview(player,location,amount,points,cap);
        change(b,booking,pkg,PointTransactionType.REDEEM,-points,null,"Dùng điểm khi xác nhận đặt sân",player);
        return discount;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void restoreForFailedBooking(Long id) {
        Booking b=lock(Booking.class,id);
        if(b.getPackageId()!=null) throw new AppException("Hoàn đơn thất bại ở cấp package");
        failed(b.getStatus()); restore(b.getId(),null,b.getPlayerId(),b.getLocationId());
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void restoreForFailedPackage(Long id) {
        BookingPackage p=lock(BookingPackage.class,id); failed(p.getStatus()); restore(null,p.getId(),p.getPlayerId(),p.getLocationId());
    }
    private void failed(BookingStatus s) {
        if(s!=BookingStatus.EXPIRED && s!=BookingStatus.PAYMENT_REJECTED) throw new AppException("Chỉ hoàn điểm đơn hết hạn hoặc bị từ chối thanh toán");
    }
    private void restore(Long booking,Long pkg,Long player,Long location) {
        if(player==null) return;
        PlayerLocationBalance b=balance(player,location,false);
        var spent=previous(booking,pkg,PointTransactionType.REDEEM);
        if(spent.isPresent() && previous(booking,pkg,PointTransactionType.RETURN).isEmpty())
            change(b,booking,pkg,PointTransactionType.RETURN,-spent.get().getPoints(),null,"Hoàn điểm đơn thất bại",null);
    }
    /** F4 calls after setting Payment and its target CONFIRMED, in the same transaction. No HTTP earn endpoint. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void accrueForConfirmedPayment(Long paymentId) {
        Payment p=lock(Payment.class,paymentId);
        if(p.getStatus()!=PaymentStatus.CONFIRMED) throw new AppException("Thanh toán chưa xác nhận");
        if(accruals.existsByPaymentId(paymentId)) return;
        Long player,booking=null,pkg=null;
        if(p.getPackageId()!=null) {
            BookingPackage target=lock(BookingPackage.class,p.getPackageId());
            if(target.getStatus()!=BookingStatus.CONFIRMED || !p.getLocationId().equals(target.getLocationId()) || p.getAmountDue().compareTo(target.getFinalAmount())!=0)
                throw new AppException("Package chưa xác nhận hoặc số tiền không khớp");
            pkg=target.getId(); player=target.getPlayerId();
            List<Booking> children=em.createQuery("select b from Booking b where b.packageId=:p order by b.id",Booking.class).setParameter("p",pkg).getResultList();
            if(children.isEmpty() || children.stream().anyMatch(b -> b.getStatus()!=BookingStatus.CONFIRMED || !target.getPlayerId().equals(b.getPlayerId()) || !target.getLocationId().equals(b.getLocationId())))
                throw new AppException("Các buổi của package chưa xác nhận đồng bộ");
        } else {
            Booking b;
            if(p.getRescheduleRequestId()!=null) {
                RescheduleRequest r=lock(RescheduleRequest.class,p.getRescheduleRequestId()); b=lock(Booking.class,r.getBookingId());
                if(p.getAmountDue().compareTo(r.getExtraAmount())!=0) throw new AppException("Số tiền đổi lịch không khớp");
            } else {
                b=lock(Booking.class,p.getBookingId());
                if(b.getBookingType()==BookingType.WALK_IN) return;
                if(b.getPackageId()!=null || p.getAmountDue().compareTo(b.getFinalAmount())!=0) throw new AppException("Phải xác nhận ở cấp package hoặc số tiền không khớp");
            }
            if(b.getStatus()!=BookingStatus.CONFIRMED || !b.getLocationId().equals(p.getLocationId()) || b.getPlayerId()==null)
                throw new AppException("Booking chưa xác nhận");
            booking=b.getId(); player=b.getPlayerId();
        }
        PlayerLocationBalance b=balance(player,p.getLocationId(),false);
        int rate=em.find(Location.class,p.getLocationId()).getPointEarningRate();
        if(rate<1000 || rate>100000) throw new AppException("Tỷ lệ tích điểm ngoài giới hạn P09");
        int earned=p.getAmountDue().divideToIntegralValue(BigDecimal.valueOf(rate)).intValueExact();
        if(earned>0) change(b,booking,pkg,PointTransactionType.EARN,earned,rate,"Thanh toán #"+p.getId(),p.getConfirmedBy());
        BigDecimal total=b.getTotalPaid().add(p.getAmountDue());
        if(total.precision()>14) throw new AppException("Tổng chi tiêu vượt giới hạn",HttpStatus.CONFLICT);
        b.setTotalPaid(total); b.setUpdatedAt(LocalDateTime.now());
        accruals.saveAndFlush(LoyaltyAccrual.builder().paymentId(paymentId).balanceId(b.getId()).paidAmount(p.getAmountDue()).earnedPoints(earned).earningRate(rate).build());
        milestones.reward(b);
    }
    /** F5 calls immediately after saving the Player's facility-affected choice and cancellation. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void settleFacilityCancellation(Long affectedId) {
        AffectedBooking a=lock(AffectedBooking.class,affectedId); Booking b=lock(Booking.class,a.getBookingId());
        if(a.getStatus()!=AffectedStatus.RESOLVED || b.getStatus()!=BookingStatus.CANCELLED_BY_FACILITY || a.getChoice()==null || a.getChoice()==AffectedChoice.RESCHEDULE)
            throw new AppException("Chưa có lựa chọn hoàn tiền/điểm bồi hoàn");
        if(b.getPlayerId()==null || b.getBookingType()==BookingType.WALK_IN) return;
        if(b.isLoyaltyRefundProcessed() || b.isLoyaltyCompensationProcessed()) return;
        Long confirmed=em.createQuery("select count(p) from Payment p where p.status=:s and (p.bookingId=:b or (:pkg is not null and p.packageId=:pkg))",Long.class)
                .setParameter("s",PaymentStatus.CONFIRMED).setParameter("b",b.getId()).setParameter("pkg",b.getPackageId()).getSingleResult();
        if(confirmed==0) throw new AppException("Booking chưa có thanh toán được xác nhận",HttpStatus.CONFLICT);
        PlayerLocationBalance balance=balance(b.getPlayerId(),b.getLocationId(),false);
        // Package creation must persist each session's allocated points and finalAmount (BR28).
        if(b.getPointsUsed()>0 && previous(b.getId(),null,PointTransactionType.RETURN).isEmpty())
            change(balance,b.getId(),null,PointTransactionType.RETURN,b.getPointsUsed(),null,"Hoàn điểm sân hủy",null);
        BigDecimal extras=em.createQuery("select coalesce(sum(p.amountDue),0) from Payment p where p.status=:s and p.rescheduleRequestId in (select r.id from RescheduleRequest r where r.bookingId=:b)",BigDecimal.class)
                .setParameter("s",PaymentStatus.CONFIRMED).setParameter("b",b.getId()).getSingleResult();
        BigDecimal paid=b.getFinalAmount().add(extras);
        if(a.getChoice()==AffectedChoice.REFUND) {
            // The refund request is created in the same transaction; its receipt prevents double settlement.
            RefundRequest refund=em.createQuery("select r from RefundRequest r where r.affectedBookingId=:a",RefundRequest.class)
                    .setParameter("a",a.getId()).getSingleResult();
            settleRefund(refund.getId(),refund.getSuggestedAmount());
            b.setLoyaltyRefundProcessed(true);
        } else {
            int points=paid.divide(BigDecimal.valueOf(POINT_VALUE),0,RoundingMode.CEILING).intValueExact();
            change(balance,b.getId(),null,PointTransactionType.ADJUST,points,null,"Bồi hoàn khi sân hủy (BR54)",a.getCreatedBy());
            a.setCompensationPoints(points); b.setLoyaltyCompensationProcessed(true);
            em.persist(Notification.builder().recipientId(b.getPlayerId()).type("COMPENSATION_POINTS").title("Đã cộng điểm bồi hoàn")
                    .content("Đã cộng "+points+" điểm bồi hoàn cho booking "+b.getBookingCode()).refType("BOOKING").refId(b.getId()).build());
        }
        balance.setUpdatedAt(LocalDateTime.now());
    }

    /** BR52: called on approval, and reconciled to the actual recorded amount in UC23. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void settleRefund(Long refundId,BigDecimal amount) {
        RefundRequest observed=em.find(RefundRequest.class,refundId);
        if(observed==null) throw new AppException("Không tìm thấy yêu cầu hoàn tiền",HttpStatus.NOT_FOUND);
        Booking booking=lock(Booking.class,observed.getBookingId());
        RefundRequest refund=lock(RefundRequest.class,refundId);
        if (booking.getPlayerId() == null || refund.getVerifiedUnrecordedAmount() != null) return;
        BigDecimal old=refund.getLoyaltySettledAmount();
        if(amount.compareTo(old)==0) return;
        List<LoyaltyRefundCalculator.Receipt> receipts=refundReceipts(booking);
        // Unconfirmed cash was never earned/reported as loyalty spend.
        if(receipts.isEmpty()) return;
        PlayerLocationBalance wallet=balance(booking.getPlayerId(),booking.getLocationId(),false);
        BigDecimal prior=em.createQuery("select coalesce(sum(r.loyaltySettledAmount),0) from RefundRequest r where r.bookingId=:b and r.id<>:r",BigDecimal.class)
                .setParameter("b",booking.getId()).setParameter("r",refundId).getSingleResult();
        int delta=LoyaltyRefundCalculator.points(receipts,prior.add(amount))-LoyaltyRefundCalculator.points(receipts,prior.add(old));
        if(delta>0) {
            int revoked=Math.min(delta,wallet.getPointBalance());
            if (revoked > 0) {
                change(wallet,booking.getId(),null,PointTransactionType.REVOKE,-revoked,null,"Thu hồi điểm hoàn tiền #"+refundId,refund.getRecordedBy());
                em.persist(Notification.builder().recipientId(booking.getPlayerId()).type("REFUND_POINTS_REVOKED")
                        .title("Đã thu hồi điểm tích lũy")
                        .content("Đã thu hồi " + revoked + " điểm của khoản hoàn cho " + booking.getBookingCode())
                        .refType("BOOKING").refId(booking.getId()).build());
            }
            refund.setLoyaltyRevokedPoints(refund.getLoyaltyRevokedPoints()+revoked);
        } else if(delta<0) {
            int returned=Math.min(-delta,refund.getLoyaltyRevokedPoints());
            if(returned>0) change(wallet,booking.getId(),null,PointTransactionType.RETURN,returned,null,"Điều chỉnh số tiền hoàn thực tế #"+refundId,refund.getRecordedBy());
            refund.setLoyaltyRevokedPoints(refund.getLoyaltyRevokedPoints()-returned);
        }
        wallet.setTotalPaid(wallet.getTotalPaid().subtract(amount.subtract(old)).max(BigDecimal.ZERO));
        refund.setLoyaltySettledAmount(amount);
    }

    private List<LoyaltyRefundCalculator.Receipt> refundReceipts(Booking booking) {
        List<Payment> payments=em.createQuery("select p from Payment p where p.status=:s and (p.bookingId=:b or (:pkg is not null and p.packageId=:pkg) or p.rescheduleRequestId in (select r.id from RescheduleRequest r where r.bookingId=:b)) order by p.id",Payment.class)
                .setParameter("s",PaymentStatus.CONFIRMED).setParameter("b",booking.getId()).setParameter("pkg",booking.getPackageId()).getResultList();
        List<LoyaltyRefundCalculator.Receipt> result=new ArrayList<>();
        for(Payment payment:payments) {
            LoyaltyAccrual accrual=accruals.findByPaymentId(payment.getId()).orElse(null);
            if(accrual==null) continue; // Historical payment with no receipt did not accrue through this service.
            BigDecimal cash=payment.getAmountDue(); int earned=accrual.getEarnedPoints();
            if(payment.getPackageId()!=null) {
                List<Booking> sessions=em.createQuery("select b from Booking b where b.packageId=:p order by b.id",Booking.class)
                        .setParameter("p",payment.getPackageId()).getResultList();
                BigDecimal before=BigDecimal.ZERO;
                for(Booking session:sessions) { if(session.getId().equals(booking.getId())) break; before=before.add(session.getFinalAmount()); }
                cash=booking.getFinalAmount();
                earned=LoyaltyRefundCalculator.allocatedPoints(earned,before,cash,payment.getAmountDue());
            }
            result.add(new LoyaltyRefundCalculator.Receipt(cash,earned,accrual.getEarningRate()));
        }
        return result;
    }
}
