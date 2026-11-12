package com.sep490.bms.service.promotion;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.promotion.*;
import com.sep490.bms.security.*;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Quản lý mốc chi tiêu theo địa điểm và cấp voucher khi Player đạt mốc.
 */
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
        // Old session configurations retain their identity/rewards and are never reinterpreted as VND.
        return tiers.findByLocationIdOrderByMilestoneAmountAsc(location).stream().filter(t -> t.getSessionThreshold()==null).toList();
    }
    private LoyaltyMilestoneResponse response(LoyaltyTier t) {
        return LoyaltyMilestoneResponse.from(t,VoucherResponse.from(vouchers.findById(t.getVoucherId()).orElseThrow()));
    }
    @Transactional
    public LoyaltyMilestoneResponse create(UserPrincipal user,@Valid LoyaltyMilestoneRequest r) {
        Location l=ownerLocation(user,true);
        if(tiers.existsByLocationIdAndMilestoneAmount(l.getId(),r.milestoneAmount()))
            throw new AppException("Mốc chi tiêu đã tồn tại",HttpStatus.CONFLICT);
        Voucher v=template(l.getId(),r);
        return response(tiers.saveAndFlush(LoyaltyTier.builder().locationId(l.getId())
                .milestoneAmount(r.milestoneAmount()).voucherId(v.getId()).build()));
    }
    @Transactional
    public LoyaltyMilestoneResponse update(UserPrincipal user,Long id,@Valid LoyaltyMilestoneUpdateRequest r) {
        Long location=ownerLocation(user,true).getId();
        LoyaltyTier t=tiers.findById(id).orElseThrow(() -> new AppException("Không tìm thấy cấu hình",HttpStatus.NOT_FOUND));
        if(!location.equals(t.getLocationId())) throw new AppException("Mốc không thuộc địa điểm",HttpStatus.FORBIDDEN);
        em.refresh(t,LockModeType.PESSIMISTIC_WRITE);
        if(t.getSessionThreshold()!=null) throw new AppException("Cấu hình số buổi cũ chỉ giữ để tra cứu lịch sử",HttpStatus.CONFLICT);
        if(t.getVersion()!=r.version()) throw new AppException("Cấu hình đã thay đổi; tải lại",HttpStatus.CONFLICT);
        if(t.getMilestoneAmount().compareTo(r.settings().milestoneAmount())!=0 && tiers.existsByLocationIdAndMilestoneAmount(location,r.settings().milestoneAmount()))
            throw new AppException("Mốc chi tiêu đã tồn tại",HttpStatus.CONFLICT);
        // Validate before mutation so query auto-flush does not increment the version twice.
        // A fresh template preserves the value/expiry of grants already issued (BR52).
        t.setVoucherId(template(location,r.settings()).getId());
        t.setMilestoneAmount(r.settings().milestoneAmount()); t.setActive(r.active());
        return response(tiers.saveAndFlush(t));
    }
    private Voucher template(Long location,LoyaltyMilestoneRequest r) {
        return vouchers.saveAndFlush(Voucher.builder().locationId(location).name(r.name().trim()).source(VoucherSource.LOYALTY)
                .targetGroup(VoucherTargetGroup.SPECIFIED).discountType(DiscountType.AMOUNT).discountValue(r.rewardValue())
                .grantValidDays(r.voucherValidDays()).status(VoucherStatus.PUBLISHED).build());
    }
    /** BR12: caller holds venue/player locks. Every confirmed payment, including extras, evaluates all thresholds. */
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void reward(PlayerLocationBalance balance) {
        List<LoyaltyTier> active=configured(balance.getLocationId()).stream().filter(LoyaltyTier::isActive).toList();
        for(int i=0;i<active.size();i++) {
            LoyaltyTier t=active.get(i);
            Voucher v=vouchers.lockById(t.getVoucherId()).orElseThrow();
            em.refresh(v,LockModeType.PESSIMISTIC_WRITE);
            if(v.getStatus()!=VoucherStatus.PUBLISHED) continue;
            List<BigDecimal> issued=em.createQuery("select r.reachedAmount from LoyaltyReward r where r.playerId=:p and r.loyaltyTierId=:t",BigDecimal.class)
                    .setParameter("p",balance.getPlayerId()).setParameter("t",t.getId()).getResultList();
            for(BigDecimal reached:MonetaryMilestones.due(balance.getTotalPaid(),t.getMilestoneAmount(),i==active.size()-1,issued)) {
                    VoucherGrant g=grants.saveAndFlush(VoucherGrant.builder().voucherId(v.getId()).playerId(balance.getPlayerId())
                            .expiresAt(LocalDateTime.now().plusDays(v.getGrantValidDays())).note("Loyalty reward: total spend "+reached.toPlainString()).build());
                    rewards.saveAndFlush(LoyaltyReward.builder().playerId(balance.getPlayerId()).loyaltyTierId(t.getId())
                            .reachedAmount(reached).voucherGrantId(g.getId()).build());
            }
        }
    }
}
