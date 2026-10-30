package com.sep490.bms.service.promotion;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.dto.request.VoucherGrantRequest;
import com.sep490.bms.entity.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.repository.*;
import com.sep490.bms.repository.promotion.*;
import com.sep490.bms.security.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;
import lombok.RequiredArgsConstructor;

@Service @Validated @RequiredArgsConstructor
@Transactional(readOnly=true)
public class VoucherService {
    private final VoucherRepository vouchers;
    private final VoucherGrantRepository grants;
    private final VoucherUsageRepository usages;
    private final AccountRepository accounts;
    private final LocationRepository locations;
    private final LocationAccessService scope;
    private final EntityManager em;

    private Pageable page(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new AppException("Phân trang không hợp lệ");
        return PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"id"));
    }
    private void role(UserPrincipal user, Role role) {
        if (user == null || user.getRole() != role) throw new AppException("Không có quyền thực hiện",HttpStatus.FORBIDDEN);
    }
    private Long ownerLocation(UserPrincipal user) {
        role(user,Role.OWNER);
        Location l=scope.selectedLocation(user);
        activeLocation(l.getId());
        return l.getId();
    }
    private void activeLocation(Long id) {
        if (locations.findById(id).filter(l -> "ACTIVE".equals(l.getStatus())).isEmpty())
            throw new AppException("Địa điểm không hoạt động",HttpStatus.NOT_FOUND);
    }
    private Voucher locked(Long id) {
        return vouchers.lockById(id).orElseThrow(() -> new AppException("Không tìm thấy voucher",HttpStatus.NOT_FOUND));
    }
    private Voucher owned(UserPrincipal user, Long id) {
        Long location=ownerLocation(user);
        Voucher v=locked(id);
        if (!location.equals(v.getLocationId())) throw new AppException("Voucher không thuộc địa điểm đã chọn",HttpStatus.FORBIDDEN);
        return v;
    }
    public PageResponse<VoucherResponse> publicList(Long location, int page, int size) {
        activeLocation(location);
        LocalDate today=LocalDate.now();
        return PageResponse.from(vouchers.findAll((r,q,c) -> c.and(
                c.equal(r.get("locationId"),location), c.equal(r.get("status"),VoucherStatus.PUBLISHED),
                c.notEqual(r.get("targetGroup"),VoucherTargetGroup.SPECIFIED),
                c.or(c.isNull(r.get("validFrom")),c.lessThanOrEqualTo(r.get("validFrom"),today)),
                c.or(c.isNull(r.get("validTo")),c.greaterThanOrEqualTo(r.get("validTo"),today)),
                c.or(c.isNull(r.get("maxTotalUses")),c.lessThan(r.get("usedCount"),r.get("maxTotalUses"))),
                c.or(c.isNull(r.get("budget")),c.lessThan(r.get("budgetUsed"),r.get("budget")))) ,page(page,size)).map(VoucherResponse::from));
    }
    public PageResponse<VoucherResponse> ownerList(UserPrincipal user, VoucherStatus status,int page,int size) {
        return list(ownerLocation(user),status,page,size);
    }
    public PageResponse<VoucherResponse> adminList(UserPrincipal user, Long location,VoucherStatus status,int page,int size) {
        role(user,Role.ADMIN); return list(location,status,page,size);
    }
    private PageResponse<VoucherResponse> list(Long location,VoucherStatus status,int page,int size) {
        Specification<Voucher> spec=(r,q,c) -> c.and(location==null ? c.conjunction():c.equal(r.get("locationId"),location),
                status==null ? c.conjunction():c.equal(r.get("status"),status));
        return PageResponse.from(vouchers.findAll(spec,page(page,size)).map(VoucherResponse::from));
    }
    public PageResponse<PersonalVoucherResponse> personalList(UserPrincipal user,int page,int size) {
        role(user,Role.PLAYER);
        return PageResponse.from(grants.findByPlayerId(user.getId(),page(page,size)).map(g -> new PersonalVoucherResponse(
                g.getId(),g.getStatus(),g.getGrantedAt(),g.getExpiresAt(),VoucherResponse.from(vouchers.findById(g.getVoucherId()).orElseThrow()))));
    }
    @Transactional
    public VoucherResponse create(UserPrincipal user,@Valid VoucherWriteRequest request) {
        Voucher v=Voucher.builder().locationId(ownerLocation(user)).source(VoucherSource.CAMPAIGN).build();
        configure(v,request); return VoucherResponse.from(vouchers.saveAndFlush(v));
    }
    @Transactional
    public VoucherResponse update(UserPrincipal user,Long id,@Valid VoucherUpdateRequest request) {
        Voucher v=owned(user,id);
        if(v.getStatus()!=VoucherStatus.DRAFT || v.getSource()!=VoucherSource.CAMPAIGN)
            throw new AppException("Chỉ sửa được campaign DRAFT",HttpStatus.CONFLICT);
        if(v.getVersion()!=request.version()) throw new AppException("Voucher đã thay đổi; tải lại dữ liệu",HttpStatus.CONFLICT);
        configure(v,request.voucher()); return VoucherResponse.from(vouchers.saveAndFlush(v));
    }
    private void configure(Voucher v,VoucherWriteRequest r) {
        if(r.validTo().isBefore(LocalDate.now())) throw new AppException("Voucher đã hết hạn");
        String code=r.code()==null ? null:r.code().toUpperCase(Locale.ROOT);
        if(code!=null && !code.equals(v.getCode()) && vouchers.existsByLocationIdAndCode(v.getLocationId(),code))
            throw new AppException("Mã voucher đã tồn tại tại địa điểm",HttpStatus.CONFLICT);
        v.setCode(code); v.setName(r.name().trim()); v.setTargetGroup(r.targetGroup()); v.setDiscountType(r.discountType());
        v.setDiscountValue(r.discountValue()); v.setMinOrderAmount(r.minOrderAmount()); v.setValidFrom(r.validFrom());
        v.setValidTo(r.validTo()); v.setGrantValidDays(r.grantValidDays()); v.setMaxUsesPerPlayer(r.maxUsesPerPlayer());
        v.setMaxTotalUses(r.maxTotalUses()); v.setBudget(r.budget());
        v.setAllowPoints(Boolean.TRUE.equals(r.allowPoints())); v.setMaxPointPercent(r.maxPointPercent());
    }
    @Transactional
    public VoucherResponse publish(UserPrincipal user,Long id) {
        Voucher v=owned(user,id);
        if(v.getStatus()==VoucherStatus.DISABLED || v.getSource()!=VoucherSource.CAMPAIGN)
            throw new AppException("Voucher không thể publish",HttpStatus.CONFLICT);
        if(v.getValidFrom()==null || v.getValidTo()==null || v.getValidTo().isBefore(LocalDate.now()))
            throw new AppException("Ngày hiệu lực voucher không hợp lệ");
        v.setStatus(VoucherStatus.PUBLISHED); return VoucherResponse.from(vouchers.saveAndFlush(v));
    }
    @Transactional
    public VoucherResponse disable(UserPrincipal user,Long id) {
        role(user,Role.ADMIN); Voucher v=locked(id);
        v.setStatus(VoucherStatus.DISABLED); v.setDisabledBy(user.getId());
        return VoucherResponse.from(vouchers.saveAndFlush(v));
    }
    @Transactional
    public List<PersonalVoucherResponse> grant(UserPrincipal user,Long id,@Valid VoucherGrantRequest request) {
        Voucher v=owned(user,id);
        if(v.getStatus()!=VoucherStatus.PUBLISHED || v.getTargetGroup()!=VoucherTargetGroup.SPECIFIED || v.getSource()!=VoucherSource.CAMPAIGN)
            throw new AppException("Chỉ cấp campaign SPECIFIED đã publish",HttpStatus.CONFLICT);
        if(v.getValidTo()!=null && v.getValidTo().isBefore(LocalDate.now())) throw new AppException("Voucher hết hạn");
        Set<Long> ids=new LinkedHashSet<>(request.playerIds());
        if(ids.size()>100) throw new AppException("Tối đa100 Player mỗi yêu cầu");
        for(Long player:ids) if(accounts.findById(player).filter(a -> a.getRole()==Role.PLAYER && a.getStatus()==AccountStatus.ACTIVE).isEmpty())
            throw new AppException("Player không tồn tại hoặc không hoạt động");
        LocalDateTime now=LocalDateTime.now();
        LocalDateTime expiry=v.getValidTo()==null ? null:v.getValidTo().plusDays(1).atStartOfDay();
        if(v.getGrantValidDays()!=null) {
            LocalDateTime relative=now.plusDays(v.getGrantValidDays());
            if(expiry==null || relative.isBefore(expiry)) expiry=relative;
        }
        List<PersonalVoucherResponse> result=new ArrayList<>();
        for(Long player:ids) {
            VoucherGrant g=grants.saveAndFlush(VoucherGrant.builder().voucherId(id).playerId(player).expiresAt(expiry).build());
            result.add(new PersonalVoucherResponse(g.getId(),g.getStatus(),g.getGrantedAt(),g.getExpiresAt(),VoucherResponse.from(v)));
        }
        return result;
    }
    public VoucherCheckResponse check(UserPrincipal user,@Valid VoucherCheckRequest request) {
        role(user,Role.PLAYER);
        Voucher v=resolve(request.locationId(),request.selection(),false);
        return evaluate(v,user.getId(),request.locationId(),request.orderAmount(),request.selection());
    }
    private Voucher resolve(Long location,VoucherSelection selection,boolean lock) {
        Long id;
        if(selection.grantId()!=null) id=grants.findById(selection.grantId()).orElseThrow(() -> new AppException("Voucher không khả dụng")).getVoucherId();
        else id=vouchers.findIdByLocationAndCode(location,selection.code().trim().toUpperCase(Locale.ROOT))
                .orElseThrow(() -> new AppException("Voucher không khả dụng"));
        if(!lock) return vouchers.findById(id).orElseThrow();
        Voucher v=locked(id);
        // resolve may have loaded this entity before waiting for another transaction.
        em.refresh(v,LockModeType.PESSIMISTIC_WRITE);
        if(selection.grantId()!=null) em.refresh(grants.findById(selection.grantId()).orElseThrow());
        return v;
    }
    private VoucherCheckResponse evaluate(Voucher v,Long player,Long location,BigDecimal amount,VoucherSelection selection) {
        activeLocation(location);
        if(!location.equals(v.getLocationId()) || v.getStatus()!=VoucherStatus.PUBLISHED) throw new AppException("Voucher không khả dụng");
        LocalDateTime now=LocalDateTime.now();
        if(v.getValidFrom()!=null && now.toLocalDate().isBefore(v.getValidFrom()) || v.getValidTo()!=null && now.toLocalDate().isAfter(v.getValidTo()))
            throw new AppException("Voucher ngoài thời hạn sử dụng");
        if(v.getTargetGroup()==VoucherTargetGroup.SPECIFIED) {
            VoucherGrant g=selection.grantId()==null ? null:grants.findById(selection.grantId()).orElse(null);
            if(g==null || !g.getVoucherId().equals(v.getId()) || !g.getPlayerId().equals(player) || g.getStatus()!=VoucherGrantStatus.AVAILABLE
                    || g.getExpiresAt()!=null && !g.getExpiresAt().isAfter(now)) throw new AppException("Voucher cá nhân không khả dụng");
        } else if(selection.grantId()!=null) throw new AppException("Voucher công khai phải chọn bằng code");
        if(v.getTargetGroup()==VoucherTargetGroup.NEW_PLAYERS && em.createQuery(
                "select count(b) from Booking b where b.playerId=:p and b.locationId=:l and b.status in :states",Long.class)
                .setParameter("p",player).setParameter("l",location)
                .setParameter("states",List.of(BookingStatus.CONFIRMED,BookingStatus.IN_USE,BookingStatus.COMPLETED)).getSingleResult()>0)
            throw new AppException("Voucher chỉ dành cho Player mới tại địa điểm");
        if(amount.compareTo(v.getMinOrderAmount())<0) throw new AppException("Chưa đạt giá trị đơn tối thiểu");
        if(v.getMaxTotalUses()!=null && v.getUsedCount()>=v.getMaxTotalUses()) throw new AppException("Voucher hết lượt");
        if(v.getMaxUsesPerPlayer()!=null && usages.countByVoucherIdAndPlayerIdAndStatus(v.getId(),player,VoucherUsageStatus.USED)>=v.getMaxUsesPerPlayer())
            throw new AppException("Đã hết lượt sử dụng cá nhân");
        BigDecimal discount=v.getDiscountType()==DiscountType.AMOUNT ? v.getDiscountValue()
                :amount.multiply(v.getDiscountValue()).divide(BigDecimal.valueOf(100),0,RoundingMode.DOWN);
        // The existing SQL schema requires a strictly positive final_amount.
        discount=discount.min(amount.subtract(BigDecimal.ONE));
        if(discount.signum()<=0) throw new AppException("Giá trị giảm không hợp lệ");
        if(v.getBudget()!=null && v.getBudgetUsed().add(discount).compareTo(v.getBudget())>0) throw new AppException("Voucher không đủ ngân sách");
        return new VoucherCheckResponse(v.getId(),selection.grantId(),amount,discount,amount.subtract(discount));
    }

    /** F3 must call inside booking-creation transaction, after saving the booking. Never expose as an HTTP mutation. */
    @Transactional(propagation=Propagation.MANDATORY)
    public VoucherUsage consumeForBooking(Long bookingId,@Valid VoucherSelection selection) {
        var b=em.find(com.sep490.bms.entity.booking.Booking.class,bookingId,LockModeType.PESSIMISTIC_WRITE);
        if(b==null) throw new AppException("Không tìm thấy booking",HttpStatus.NOT_FOUND);
        if(b.getPlayerId()==null || b.getBookingType()==BookingType.WALK_IN || b.getPackageId()!=null || b.getStatus()!=BookingStatus.HOLDING
                || b.getHoldExpiresAt()!=null && !b.getHoldExpiresAt().isAfter(LocalDateTime.now())) throw new AppException("Booking không thể dùng voucher");
        Voucher v=resolve(b.getLocationId(),selection,true);
        Optional<VoucherUsage> existing=usages.findByBookingId(bookingId);
        if(existing.isPresent()) {
            VoucherUsage u=existing.get();
            if(u.getStatus()!=VoucherUsageStatus.USED || !u.getVoucherId().equals(v.getId()) || !Objects.equals(u.getVoucherGrantId(),selection.grantId()))
                throw new AppException("Booking đã có lịch sử voucher",HttpStatus.CONFLICT);
            return u;
        }
        VoucherCheckResponse quote=evaluate(v,b.getPlayerId(),b.getLocationId(),b.getListAmount(),selection);
        if(b.getPointsUsed()>0) throw new AppException("Phải áp voucher trước điểm (BR41)");
        if(quote.discountAmount().add(b.getPointDiscount()).compareTo(b.getListAmount())>=0) throw new AppException("Tổng giảm phải nhỏ hơn giá trị đơn");
        v.setUsedCount(v.getUsedCount()+1); v.setBudgetUsed(v.getBudgetUsed().add(quote.discountAmount()));
        if(selection.grantId()!=null) grants.findById(selection.grantId()).orElseThrow().setStatus(VoucherGrantStatus.USED);
        b.setVoucherDiscount(quote.discountAmount()); b.setFinalAmount(quote.amountAfterVoucher().subtract(b.getPointDiscount()));
        return usages.saveAndFlush(VoucherUsage.builder().voucherId(v.getId()).voucherGrantId(selection.grantId()).playerId(b.getPlayerId())
                .bookingId(bookingId).discountAmount(quote.discountAmount()).build());
    }
    /** F3 failure/expiry/cancellation transaction; rollback of creation already restores all state automatically. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void restoreForFailedBooking(Long bookingId) {
        var b=em.find(com.sep490.bms.entity.booking.Booking.class,bookingId,LockModeType.PESSIMISTIC_WRITE);
        if(b==null) throw new AppException("Không tìm thấy booking",HttpStatus.NOT_FOUND);
        if(!List.of(BookingStatus.EXPIRED,BookingStatus.PAYMENT_REJECTED,BookingStatus.CANCELLED_BY_FACILITY).contains(b.getStatus()))
            throw new AppException("Booking chưa ở trạng thái thất bại được hoàn voucher");
        var found=usages.findByBookingId(bookingId);
        if(found.isEmpty()) return;
        VoucherUsage u=found.get(); Voucher v=locked(u.getVoucherId());
        if(u.getStatus()==VoucherUsageStatus.RETURNED) return;
        if(v.getUsedCount()<1 || v.getBudgetUsed().compareTo(u.getDiscountAmount())<0) throw new AppException("Dữ liệu lượt voucher không nhất quán",HttpStatus.CONFLICT);
        v.setUsedCount(v.getUsedCount()-1); v.setBudgetUsed(v.getBudgetUsed().subtract(u.getDiscountAmount()));
        if(u.getVoucherGrantId()!=null) grants.findById(u.getVoucherGrantId()).orElseThrow().setStatus(VoucherGrantStatus.AVAILABLE);
        u.setStatus(VoucherUsageStatus.RETURNED); u.setReturnedAt(LocalDateTime.now());
    }
}
