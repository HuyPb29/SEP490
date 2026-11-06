package com.sep490.bms.service.booking;

import java.math.*;
import java.time.*;
import java.util.*;
import com.sep490.bms.dto.request.PackageBookingRequest;
import com.sep490.bms.dto.request.PackageBookingRequest.Slot;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.entity.*;
import com.sep490.bms.entity.booking.*;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.security.*;
import com.sep490.bms.service.promotion.*;
import com.sep490.bms.service.team.TeamService;
import jakarta.persistence.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor @Transactional
public class PackageBookingService {
    private final EntityManager em;
    private final PriceCalculator prices;
    private final SlotAvailabilityService availability;
    private final VoucherService vouchers;
    private final LoyaltyPointService points;
    private final TeamService teams;
    private final BookingCodeGenerator codes;
    private final LocationAccessService scope;
    public record SessionQuote(Slot slot,BigDecimal listAmount,String conflict) {}
    public record Preview(List<SessionQuote> sessions,BigDecimal listAmount,BigDecimal voucherDiscount,
            BigDecimal pointDiscount,BigDecimal finalAmount,Long batchOfferId,boolean batchRewardEligible) {}
    public record View(BookingPackage bookingPackage,List<Booking> sessions) {}

    private void player(UserPrincipal user) {
        if(user==null || user.getRole()!=Role.PLAYER) throw new AppException("Chỉ Player đặt gói",HttpStatus.FORBIDDEN);
    }
    public static List<Slot> expand(PackageBookingRequest r) {
        if(r.startDate()==null || r.endDate()==null || r.endDate().isBefore(r.startDate()) || r.endDate().isAfter(r.startDate().plusMonths(3).minusDays(1)))
            throw new AppException("Kỳ gói tối đa 3 tháng (BR27)");
        List<Slot> slots=new ArrayList<>();
        if(r.packageType()==PackageType.RECURRING) {
            if(r.pattern()==null || r.pattern().isEmpty() || r.endDate().isBefore(r.startDate().plusMonths(1).minusDays(1))) throw new AppException("Mẫu định kỳ phải có ít nhất 1 buổi/tuần, trong 1–3 tháng (MSG41)");
            if(r.sessions()!=null && !r.sessions().isEmpty()) throw new AppException("Gói định kỳ dùng pattern");
            for(LocalDate d=r.startDate();!d.isAfter(r.endDate());d=d.plusDays(1)) for(var p:r.pattern())
                if(p.dayOfWeek()==d.getDayOfWeek().getValue()) slots.add(new Slot(r.courtId(),d,p.startMinute(),p.endMinute()));
        } else {
            if(r.packageType()!=PackageType.CUSTOM || r.sessions()==null) throw new AppException("Gói tự chọn cần danh sách buổi");
            slots.addAll(r.sessions());
        }
        slots=new ArrayList<>(new LinkedHashSet<>(slots));
        if(r.replacements()!=null) for(var replacement:r.replacements()) {
            if(!slots.remove(replacement.original())) throw new AppException("Buổi cần thay không có trong lịch ban đầu");
            if(replacement.replacement()!=null) slots.add(replacement.replacement());
        }
        slots=new ArrayList<>(new LinkedHashSet<>(slots));
        if(slots.size()<2) throw new AppException("Gói phải còn ít nhất 2 buổi (MSG92)");
        for(Slot s:slots) {
            if(s.date()==null || s.courtId()==null || s.startMinute()<0 || s.endMinute()>1440 || s.endMinute()<=s.startMinute() || s.startMinute()%30!=0 || s.endMinute()%30!=0
                    || s.date().isBefore(r.startDate()) || s.date().isAfter(r.endDate())) throw new AppException("Buổi của gói không hợp lệ");
        }
        slots.sort(Comparator.comparing(Slot::date).thenComparing(Slot::courtId).thenComparingInt(Slot::startMinute));
        for(int i=1;i<slots.size();i++) {
            Slot a=slots.get(i-1),b=slots.get(i);
            if(a.date().equals(b.date()) && a.courtId().equals(b.courtId()) && b.startMinute()<a.endMinute()) throw new AppException("Các buổi trong gói chồng nhau");
        }
        return slots;
    }
    private Location location(PackageBookingRequest r) {
        Court court=em.find(Court.class,r.courtId());
        if(court==null || !court.isActive()) throw new AppException("Không tìm thấy sân",HttpStatus.NOT_FOUND);
        Location location=em.find(Location.class,court.getLocationId());
        if(!"ACTIVE".equals(location.getStatus())) throw new AppException("Địa điểm không hoạt động");
        return location;
    }
    @Transactional(readOnly=true)
    public Preview preview(UserPrincipal user,PackageBookingRequest r) {
        player(user);Location location=location(r);
        if(r.teamId()!=null && !teams.isCaptain(r.teamId(),user.getId())) throw new AppException("Không phải đội trưởng",HttpStatus.FORBIDDEN);
        List<SessionQuote> quote=new ArrayList<>();BigDecimal total=BigDecimal.ZERO;
        for(Slot slot:expand(r)) {
            Court court=em.find(Court.class,slot.courtId());
            if(court==null || !court.isActive() || !court.getLocationId().equals(location.getId())) throw new AppException("Sân phải cùng địa điểm và hoạt động");
            String conflict=null;BigDecimal amount=BigDecimal.ZERO;
            if(!slot.date().atStartOfDay().plusMinutes(slot.startMinute()).isAfter(LocalDateTime.now())) conflict="Buổi phải ở tương lai";
            else if(availability.findProblem(location.getId(),court.getId(),slot.date(),slot.startMinute(),slot.endMinute()).isPresent()) conflict="Trùng lịch, bảo trì hoặc ngoài giờ mở cửa";
            try { amount=prices.totalPrice(court.getId(),slot.date(),slot.startMinute(),slot.endMinute()); }
            catch(AppException error) { conflict=error.getMessage(); }
            quote.add(new SessionQuote(slot,amount,conflict));total=total.add(amount);
        }
        VoucherSelection selection=selection(r);BigDecimal discount=BigDecimal.ZERO;
        if(selection!=null && total.signum()>0) discount=vouchers.check(user,new VoucherCheckRequest(location.getId(),total,selection)).discountAmount();
        BigDecimal pointDiscount=r.pointsToUse()==null || r.pointsToUse()==0?BigDecimal.ZERO:points.preview(user.getId(),location.getId(),total.subtract(discount),r.pointsToUse());
        BigDecimal payable=total.subtract(discount).subtract(pointDiscount);
        List<BatchOffer> offers=em.createQuery("select o from BatchOffer o where o.locationId=:l and o.startDate<=:d and o.endDate>=:d order by o.id",BatchOffer.class)
                .setParameter("l",location.getId()).setParameter("d",LocalDate.now()).getResultList();
        BatchOffer offer=offers.isEmpty()?null:offers.get(0);
        return new Preview(quote,total,discount,pointDiscount,payable,offer==null?null:offer.getId(),offer!=null && payable.compareTo(offer.getMinPackageAmount())>=0);
    }
    private VoucherSelection selection(PackageBookingRequest r) {
        if(r.voucherCode()!=null && !r.voucherCode().isBlank() && r.voucherGrantId()!=null) throw new AppException("Chỉ chọn một voucher");
        return r.voucherGrantId()!=null?new VoucherSelection(null,r.voucherGrantId()):r.voucherCode()!=null && !r.voucherCode().isBlank()?new VoucherSelection(r.voucherCode(),null):null;
    }
    public View create(UserPrincipal user,PackageBookingRequest r) {
        player(user); em.find(Account.class,user.getId(),LockModeType.PESSIMISTIC_WRITE);
        LocalDateTime now=LocalDateTime.now().withNano(0);
        long pending=em.createQuery("select count(b) from Booking b where b.playerId=:p and b.packageId is null and (b.status in :s or (b.status=:h and b.holdExpiresAt>:n))",Long.class)
                .setParameter("p",user.getId()).setParameter("s",List.of(BookingStatus.AWAITING_CONFIRMATION,BookingStatus.RESUBMIT_REQUESTED)).setParameter("h",BookingStatus.HOLDING).setParameter("n",now).getSingleResult();
        pending+=em.createQuery("select count(p) from BookingPackage p where p.playerId=:p and (p.status in :s or (p.status=:h and p.holdExpiresAt>:n))",Long.class)
                .setParameter("p",user.getId()).setParameter("s",List.of(BookingStatus.AWAITING_CONFIRMATION,BookingStatus.RESUBMIT_REQUESTED)).setParameter("h",BookingStatus.HOLDING).setParameter("n",now).getSingleResult();
        if(pending>=2) throw new AppException("Tối đa 2 đơn chờ thanh toán (MSG29)");
        Preview quote=preview(user,r);
        if(quote.sessions().stream().anyMatch(s->s.conflict()!=null)) throw new AppException("Lịch gói có xung đột; thay hoặc bỏ buổi trùng (MSG44)",HttpStatus.CONFLICT);
        BookingPackage pkg=BookingPackage.builder().locationId(location(r).getId()).playerId(user.getId()).packageType(r.packageType())
                .startDate(r.startDate()).endDate(r.endDate()).listAmount(quote.listAmount()).finalAmount(quote.listAmount())
                .batchOfferId(quote.batchRewardEligible()?quote.batchOfferId():null).holdExpiresAt(now.plusMinutes(15)).createdAt(now).build();
        em.persist(pkg);em.flush();
        List<Booking> children=new ArrayList<>();
        for(SessionQuote q:quote.sessions()) {
            Slot slot=q.slot();
            Court court=em.find(Court.class,slot.courtId());em.refresh(court,LockModeType.PESSIMISTIC_WRITE);
            if(!court.isActive() || availability.findProblem(pkg.getLocationId(),court.getId(),slot.date(),slot.startMinute(),slot.endMinute()).isPresent()) throw new AppException("Slot vừa thay đổi (MSG44)",HttpStatus.CONFLICT);
            Booking b=Booking.builder().bookingCode(codes.next()).bookingType(BookingType.SESSION).locationId(pkg.getLocationId())
                    .courtId(slot.courtId()).playerId(user.getId()).teamId(r.teamId()).packageId(pkg.getId()).playDate(slot.date())
                    .startMinute(slot.startMinute()).endMinute(slot.endMinute()).note(r.note()).listAmount(q.listAmount()).finalAmount(q.listAmount()).holdExpiresAt(pkg.getHoldExpiresAt()).createdAt(now).build();
            em.persist(b);em.flush();children.add(b);
            Map<Integer,BigDecimal> blocks=prices.rangePrices(slot.courtId(),slot.date(),slot.startMinute(),slot.endMinute());
            for(var block:blocks.entrySet()) em.persist(BookingSlot.builder().bookingId(b.getId()).courtId(b.getCourtId()).slotDate(b.getPlayDate()).slotStartMinute(block.getKey()).price(block.getValue()).build());
        }
        em.flush();
        if(selection(r)!=null) vouchers.consumeForPackage(pkg.getId(),selection(r));
        if(r.pointsToUse()!=null && r.pointsToUse()>0) points.redeemForPackage(pkg.getId(),r.pointsToUse());
        BigDecimal before=BigDecimal.ZERO;
        for(Booking b:children) {
            BigDecimal discount=allocation(pkg.getVoucherDiscount(),before,b.getListAmount(),pkg.getListAmount());
            int used=LoyaltyRefundCalculator.allocatedPoints(pkg.getPointsUsed(),before,b.getListAmount(),pkg.getListAmount());
            b.setVoucherDiscount(discount);b.setPointsUsed(used);b.setPointDiscount(allocation(pkg.getPointDiscount(),before,b.getListAmount(),pkg.getListAmount()));
            b.setFinalAmount(b.getListAmount().subtract(discount).subtract(b.getPointDiscount()));
            if(b.getFinalAmount().signum()<=0) throw new AppException("Phân bổ ưu đãi phải để lại số tiền dương cho mỗi buổi");
            before=before.add(b.getListAmount());
        }
        em.flush();return new View(pkg,children);
    }
    public static BigDecimal allocation(BigDecimal value,BigDecimal before,BigDecimal amount,BigDecimal total) {
        return before.add(amount).multiply(value).divide(total,0,RoundingMode.DOWN).subtract(before.multiply(value).divide(total,0,RoundingMode.DOWN));
    }
    @Transactional(readOnly=true)
    public View detail(UserPrincipal user,Long id) {
        BookingPackage pkg=em.find(BookingPackage.class,id);
        if(pkg==null) throw new AppException("Không tìm thấy gói",HttpStatus.NOT_FOUND);
        if(user.getRole()==Role.PLAYER) { if(!pkg.getPlayerId().equals(user.getId())) throw new AppException("Không có quyền",HttpStatus.FORBIDDEN); }
        else if(!scope.selectedLocation(user).getId().equals(pkg.getLocationId())) throw new AppException("Sai địa điểm",HttpStatus.FORBIDDEN);
        return new View(pkg,em.createQuery("select b from Booking b where b.packageId=:p order by b.id",Booking.class).setParameter("p",id).getResultList());
    }
    @Transactional(readOnly=true)
    public List<BookingPackage> mine(UserPrincipal user) {
        player(user);return em.createQuery("select p from BookingPackage p where p.playerId=:p order by p.id desc",BookingPackage.class).setParameter("p",user.getId()).getResultList();
    }
}
