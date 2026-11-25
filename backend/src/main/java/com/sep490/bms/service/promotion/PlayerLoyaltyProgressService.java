package com.sep490.bms.service.promotion;

import java.math.BigDecimal;
import java.util.HashSet;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.sep490.bms.dto.promotion.PlayerLoyaltyProgressResponse;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.promotion.LoyaltyTier;
import com.sep490.bms.entity.promotion.Voucher;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.promotion.*;
import com.sep490.bms.security.UserPrincipal;
import lombok.RequiredArgsConstructor;

/** Đọc ngưỡng chưa cấp theo BR12/BR52; không tích điểm, tạo ví hay cấp lại voucher. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly=true)
public class PlayerLoyaltyProgressService {
    private final PlayerLocationBalanceRepository balances;
    private final LoyaltyTierRepository tiers;
    private final LoyaltyRewardRepository rewards;
    private final VoucherRepository vouchers;

    public PlayerLoyaltyProgressResponse progress(UserPrincipal user, Long locationId) {
        if (user == null || user.getRole() != Role.PLAYER)
            throw new AppException("Không có quyền thực hiện", HttpStatus.FORBIDDEN);
        var balance = balances.findByPlayerIdAndLocationId(user.getId(), locationId)
                .orElseThrow(() -> new AppException("Bạn chưa có ví điểm tại địa điểm này", HttpStatus.NOT_FOUND));
        var active = tiers.findByLocationIdOrderByMilestoneAmountAsc(locationId).stream()
                .filter(t -> t.getSessionThreshold() == null && t.isActive()).toList();
        BigDecimal next = null;
        Voucher reward = null;
        for (int i = 0; i < active.size(); i++) {
            LoyaltyTier tier = active.get(i);
            Voucher voucher = vouchers.findById(tier.getVoucherId()).orElse(null);
            // Match reward(): the highest active monetary tier repeats, even if its voucher is stopped.
            if (voucher == null || voucher.getStatus() != VoucherStatus.PUBLISHED) continue;
            var issued = new HashSet<BigDecimal>();
            rewards.findByPlayerIdAndLoyaltyTierId(user.getId(), tier.getId())
                    .forEach(r -> issued.add(r.getReachedAmount().stripTrailingZeros()));
            BigDecimal target = tier.getMilestoneAmount();
            if (i == active.size() - 1) {
                while (issued.contains(target.stripTrailingZeros())) target = target.add(tier.getMilestoneAmount());
            } else if (issued.contains(target.stripTrailingZeros())) continue;
            if (next == null || target.compareTo(next) < 0) {
                next = target;
                reward = voucher;
            }
        }
        return new PlayerLoyaltyProgressResponse(locationId, balance.getTotalPaid(), next,
                next == null ? null : next.subtract(balance.getTotalPaid()).max(BigDecimal.ZERO),
                reward == null ? null : reward.getName(), reward == null ? null : reward.getDiscountValue());
    }
}
