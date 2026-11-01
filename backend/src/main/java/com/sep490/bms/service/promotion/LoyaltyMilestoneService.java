package com.sep490.bms.service.promotion;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.entity.*;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.promotion.*;
import com.sep490.bms.security.*;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Service @Validated @RequiredArgsConstructor @Transactional(readOnly=true)
public class LoyaltyMilestoneService {
    private final LoyaltyTierRepository tiers;
    private final LoyaltyRewardRepository rewards;
    private final VoucherRepository vouchers;
    private final VoucherGrantRepository grants;
    private final LocationAccessService scope;
    private final EntityManager em;

    private Location ownerLocation(UserPrincipal user, boolean lock) {
        if(user==null || user.getRole()!=Role.OWNER) throw new AppException("Chỉ Owner được cấu hình",HttpStatus.FORBIDDEN);
        Location l=scope.selectedLocation(user);
        if(lock) em.refresh(l,LockModeType.PESSIMISTIC_WRITE);
        if(!user.getId().equals(l.getOwnerId())) throw new AppException("Địa điểm không thuộc Owner",HttpStatus.FORBIDDEN);
        if(!"ACTIVE".equals(l.getStatus())) throw new AppException("Địa điểm không hoạt động");
        return l;
    }
    public List<LoyaltyMilestoneResponse> list(UserPrincipal user) {
        return configured(ownerLocation(user,false).getId()).stream().map(this::response).toList();
    }
    private List<LoyaltyTier> configured(Long location) {
        // Legacy spending tiers are retained for audit, never interpreted as session thresholds.
        return tiers.findByLocationIdOrderByMilestoneAmountAsc(location).stream().filter(t -> t.getSessionThreshold()!=null).toList();
    }
    private LoyaltyMilestoneResponse response(LoyaltyTier t) {
        return LoyaltyMilestoneResponse.from(t,VoucherResponse.from(vouchers.findById(t.getVoucherId()).orElseThrow()));
    }
    @Transactional
    public LoyaltyMilestoneResponse create(UserPrincipal user,@Valid LoyaltyMilestoneRequest r) {
        Location l=ownerLocation(user,true);
        if(!configured(l.getId()).isEmpty()) throw new AppException("Địa điểm đã có cấu hình; dùng PATCH",HttpStatus.CONFLICT);
        // Legacy SQL amount column is preserved; the new API only uses sessionThreshold.
        if(tiers.existsByLocationIdAndMilestoneAmount(l.getId(),BigDecimal.valueOf(r.sessionThreshold())))
            throw new AppException("Mốc legacy trùng giá trị; cần rà soát dữ liệu trước khi cấu hình",HttpStatus.CONFLICT);
        Voucher v=template(l.getId(),r);
        return response(tiers.saveAndFlush(LoyaltyTier.builder().locationId(l.getId()).sessionThreshold(r.sessionThreshold())
                .milestoneAmount(BigDecimal.valueOf(r.sessionThreshold())).voucherId(v.getId()).build()));
    }
    @Transactional
    public LoyaltyMilestoneResponse update(UserPrincipal user,Long id,@Valid LoyaltyMilestoneUpdateRequest r) {
        Long location=ownerLocation(user,true).getId();
        LoyaltyTier t=tiers.findById(id).orElseThrow(() -> new AppException("Không tìm thấy cấu hình",HttpStatus.NOT_FOUND));
        if(!location.equals(t.getLocationId())) throw new AppException("Mốc không thuộc địa điểm",HttpStatus.FORBIDDEN);
        em.refresh(t,LockModeType.PESSIMISTIC_WRITE);
        if(t.getSessionThreshold()==null) throw new AppException("Mốc chi tiêu legacy không phải cấu hình số buổi",HttpStatus.CONFLICT);
        if(t.getVersion()!=r.version()) throw new AppException("Cấu hình đã thay đổi; tải lại",HttpStatus.CONFLICT);
        // A fresh template preserves the value/expiry of grants already issued (BR52).
        t.setVoucherId(template(location,r.settings()).getId());
        t.setSessionThreshold(r.settings().sessionThreshold()); t.setActive(r.active());
        return response(tiers.saveAndFlush(t));
    }
    private Voucher template(Long location,LoyaltyMilestoneRequest r) {
        return vouchers.saveAndFlush(Voucher.builder().locationId(location).name(r.name().trim()).source(VoucherSource.LOYALTY)
                .targetGroup(VoucherTargetGroup.SPECIFIED).discountType(DiscountType.AMOUNT).discountValue(r.rewardValue())
                .grantValidDays(r.voucherValidDays()).status(VoucherStatus.PUBLISHED).build());
    }
    /** Caller holds the facility and player locks and has already counted the paid sessions. */
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void reward(PlayerLocationBalance balance) {
        LoyaltyTier t=configured(balance.getLocationId()).stream().filter(LoyaltyTier::isActive).findFirst().orElse(null);
        if(t==null || balance.getLoyaltySessions()<t.getSessionThreshold()) return;
        Voucher v=vouchers.lockById(t.getVoucherId()).orElseThrow();
        em.refresh(v,LockModeType.PESSIMISTIC_WRITE);
        if(v.getStatus()!=VoucherStatus.PUBLISHED) return;
        VoucherGrant g=grants.saveAndFlush(VoucherGrant.builder().voucherId(v.getId()).playerId(balance.getPlayerId())
                .expiresAt(LocalDateTime.now().plusDays(v.getGrantValidDays())).note("Loyalty reward: paid sessions").build());
        // Sequence rather than spending amount: prior rewards remain immutable after counter resets/refunds.
        Long sequence=em.createQuery("select count(r) from LoyaltyReward r where r.playerId=:p and r.loyaltyTierId=:t",Long.class)
                .setParameter("p",balance.getPlayerId()).setParameter("t",t.getId()).getSingleResult()+1;
        rewards.saveAndFlush(LoyaltyReward.builder().playerId(balance.getPlayerId()).loyaltyTierId(t.getId())
                .reachedAmount(BigDecimal.valueOf(sequence)).voucherGrantId(g.getId()).build());
        balance.setLoyaltySessions(0); // SRS 8.3 N2 explicitly resets the counter, including a package crossing the threshold.
    }
}
