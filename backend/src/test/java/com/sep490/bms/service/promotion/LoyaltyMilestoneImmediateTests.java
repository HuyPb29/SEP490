package com.sep490.bms.service.promotion;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.util.*;
import com.sep490.bms.dto.promotion.*;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.notification.Notification;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.repository.promotion.*;
import com.sep490.bms.security.*;
import jakarta.persistence.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Kiểm tra cấp thưởng ngay khi tạo mốc và chống cấp lại khi chỉnh cấu hình hoặc xác nhận tiền. */
class LoyaltyMilestoneImmediateTests {
    final LoyaltyTierRepository tiers = mock(LoyaltyTierRepository.class);
    final LoyaltyRewardRepository rewards = mock(LoyaltyRewardRepository.class);
    final VoucherRepository vouchers = mock(VoucherRepository.class);
    final VoucherGrantRepository grants = mock(VoucherGrantRepository.class);
    final LocationAccessService scope = mock(LocationAccessService.class);
    final EntityManager em = mock(EntityManager.class);
    final LoyaltyMilestoneService service = new LoyaltyMilestoneService(tiers, rewards, vouchers, grants, scope, em);
    final UserPrincipal owner = UserPrincipal.builder().id(9L).role(Role.OWNER).build();
    final List<BigDecimal> issued = new ArrayList<>();
    final PlayerLocationBalance balance = PlayerLocationBalance.builder().id(1L).locationId(1L).playerId(7L)
            .totalPaid(new BigDecimal("3000000")).build();
    LoyaltyTier saved;
    Voucher voucher;

    @BeforeEach @SuppressWarnings("unchecked") void setup() {
        when(scope.selectedLocation(owner)).thenReturn(Location.builder().id(1L).ownerId(9L).status("ACTIVE").build());
        when(vouchers.saveAndFlush(any())).thenAnswer(call -> { voucher = call.getArgument(0); voucher.setId(3L); return voucher; });
        when(vouchers.findById(3L)).thenAnswer(call -> Optional.of(voucher));
        when(vouchers.lockById(3L)).thenAnswer(call -> Optional.of(voucher));
        when(tiers.saveAndFlush(any())).thenAnswer(call -> { saved = call.getArgument(0); saved.setId(2L); return saved; });
        when(grants.saveAndFlush(any())).thenAnswer(call -> { VoucherGrant grant = call.getArgument(0); grant.setId(4L); return grant; });
        when(rewards.saveAndFlush(any())).thenAnswer(call -> { LoyaltyReward reward = call.getArgument(0); issued.add(reward.getReachedAmount()); return reward; });
        TypedQuery<PlayerLocationBalance> wallets = mock(TypedQuery.class, RETURNS_SELF);
        when(em.createQuery(anyString(), eq(PlayerLocationBalance.class))).thenReturn(wallets);
        when(wallets.getResultList()).thenReturn(List.of(balance));
        TypedQuery<BigDecimal> history = mock(TypedQuery.class, RETURNS_SELF);
        when(em.createQuery(anyString(), eq(BigDecimal.class))).thenReturn(history);
        when(history.getResultList()).thenAnswer(call -> List.copyOf(issued));
    }
    LoyaltyMilestoneRequest settings() { return new LoyaltyMilestoneRequest(new BigDecimal("1000000"), "Thưởng 1 triệu", new BigDecimal("10000"), 30); }

    @Test void creatingMilestoneImmediatelyRewardsExistingEligibleWalletOnlyOnce() {
        service.create(owner, settings());
        assertThat(issued).containsExactly(new BigDecimal("1000000"));
        when(tiers.findByLocationIdOrderByMilestoneAmountAsc(1L)).thenReturn(List.of(saved));
        service.reward(balance);
        verify(grants, times(1)).saveAndFlush(any());
        verify(em).persist(isA(Notification.class));
        assertThat(balance.getTotalPaid()).isEqualByComparingTo("3000000");
    }
    @Test void reEnablingTierDoesNotReissueAnExistingReward() {
        service.create(owner, settings());
        when(tiers.findById(2L)).thenReturn(Optional.of(saved));
        service.update(owner, 2L, new LoyaltyMilestoneUpdateRequest(saved.getVersion(), true, settings()));
        verify(grants, times(1)).saveAndFlush(any());
        assertThat(issued).hasSize(1);
    }
}
