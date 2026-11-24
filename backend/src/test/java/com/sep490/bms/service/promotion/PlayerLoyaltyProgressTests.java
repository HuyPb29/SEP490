package com.sep490.bms.service.promotion;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.promotion.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.promotion.*;
import com.sep490.bms.security.UserPrincipal;

/** Kiểm tra tiến độ chỉ đọc, phạm vi Player và mốc lặp/hoàn tiền theo quy tắc cấp thưởng hiện hành. */
class PlayerLoyaltyProgressTests {
    private final PlayerLocationBalanceRepository balances = mock(PlayerLocationBalanceRepository.class);
    private final LoyaltyTierRepository tiers = mock(LoyaltyTierRepository.class);
    private final LoyaltyRewardRepository rewards = mock(LoyaltyRewardRepository.class);
    private final VoucherRepository vouchers = mock(VoucherRepository.class);
    private final PlayerLoyaltyProgressService service = new PlayerLoyaltyProgressService(balances, tiers, rewards, vouchers);
    private final UserPrincipal player = UserPrincipal.builder().id(7L).role(Role.PLAYER).build();
    private final PlayerLocationBalance balance = PlayerLocationBalance.builder().playerId(7L).locationId(1L).totalPaid(n(400)).build();
    private BigDecimal n(long value) { return BigDecimal.valueOf(value); }

    @BeforeEach void setup() {
        when(balances.findByPlayerIdAndLocationId(7L, 1L)).thenReturn(Optional.of(balance));
    }
    private LoyaltyTier tier(long id, long amount) {
        var tier = LoyaltyTier.builder().id(id).locationId(1L).milestoneAmount(n(amount)).voucherId(id).build();
        when(vouchers.findById(id)).thenReturn(Optional.of(Voucher.builder().id(id).name("Thưởng " + id)
                .discountValue(n(50)).status(VoucherStatus.PUBLISHED).build()));
        return tier;
    }
    private void issued(long tier, BigDecimal... amounts) {
        when(rewards.findByPlayerIdAndLoyaltyTierId(7L, tier)).thenReturn(java.util.Arrays.stream(amounts)
                .map(a -> LoyaltyReward.builder().reachedAmount(a).build()).toList());
    }
    @Test void nextUnissuedThresholdAndRemainingSpend() {
        var configured = List.of(tier(1, 500), tier(2, 1000));
        when(tiers.findByLocationIdOrderByMilestoneAmountAsc(1L)).thenReturn(configured);
        var result = service.progress(player, 1L);
        assertThat(result.nextMilestoneAmount()).isEqualByComparingTo("500");
        assertThat(result.remainingAmount()).isEqualByComparingTo("100");
        assertThat(result.rewardName()).isEqualTo("Thưởng 1");
        assertThat(result.totalPaid()).isEqualByComparingTo("400");
        verify(balances).findByPlayerIdAndLocationId(7L, 1L);
        verify(balances, never()).save(any());
        verify(rewards, never()).save(any());
    }
    @Test void lowerAwardIsNotRepeatedAndHighestRepeatsAtExactMultiples() {
        var configured = List.of(tier(1, 500), tier(2, 1000));
        when(tiers.findByLocationIdOrderByMilestoneAmountAsc(1L)).thenReturn(configured);
        issued(1, n(500)); issued(2, n(1000), n(2000));
        balance.setTotalPaid(n(2300));
        assertThat(service.progress(player, 1L).nextMilestoneAmount()).isEqualByComparingTo("3000");
    }
    @Test void refundDoesNotOfferAlreadyIssuedAmountAgainRegardlessOfDecimalScale() {
        var configured = List.of(tier(2, 1000));
        when(tiers.findByLocationIdOrderByMilestoneAmountAsc(1L)).thenReturn(configured);
        issued(2, new BigDecimal("1000.00"), n(2000));
        var result = service.progress(player, 1L);
        assertThat(result.nextMilestoneAmount()).isEqualByComparingTo("3000");
        assertThat(result.remainingAmount()).isEqualByComparingTo("2600");
    }
    @Test void reachedButUnissuedThresholdRemainsVisibleUntilNextPayment() {
        var configured = List.of(tier(2, 1000));
        when(tiers.findByLocationIdOrderByMilestoneAmountAsc(1L)).thenReturn(configured);
        balance.setTotalPaid(n(2500));
        var result = service.progress(player, 1L);
        assertThat(result.nextMilestoneAmount()).isEqualByComparingTo("1000");
        assertThat(result.remainingAmount()).isZero();
    }
    @Test void inactiveAndLegacySessionTiersAreExcluded() {
        var inactive = tier(1, 100); inactive.setActive(false);
        var legacy = tier(2, 200); legacy.setSessionThreshold(5);
        when(tiers.findByLocationIdOrderByMilestoneAmountAsc(1L)).thenReturn(List.of(inactive, legacy));
        assertThat(service.progress(player, 1L).nextMilestoneAmount()).isNull();
    }
    @Test void stoppedHighestVoucherDoesNotMakeLowerTierRepeat() {
        var lower = tier(1, 500); var highest = tier(2, 1000);
        when(vouchers.findById(2L)).thenReturn(Optional.of(Voucher.builder().status(VoucherStatus.STOPPED).build()));
        when(tiers.findByLocationIdOrderByMilestoneAmountAsc(1L)).thenReturn(List.of(lower, highest));
        issued(1, n(500));
        assertThat(service.progress(player, 1L).nextMilestoneAmount()).isNull();
    }
    @Test void noActiveRewardReturnsSpendWithoutInventingTarget() {
        var result = service.progress(player, 1L);
        assertThat(result.totalPaid()).isEqualByComparingTo("400");
        assertThat(result.nextMilestoneAmount()).isNull();
        assertThat(result.rewardValue()).isNull();
    }
    @Test void missingOwnWalletDoesNotReadAnotherPlayersMilestones() {
        when(balances.findByPlayerIdAndLocationId(7L, 2L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.progress(player, 2L)).isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(org.springframework.http.HttpStatus.NOT_FOUND);
        verifyNoInteractions(tiers, rewards, vouchers);
    }
    @Test void guestAndOtherRolesAreForbiddenBeforeReadingData() {
        assertThatThrownBy(() -> service.progress(null, 1L)).isInstanceOf(AppException.class);
        for (Role role : List.of(Role.OWNER, Role.STAFF, Role.ADMIN))
            assertThatThrownBy(() -> service.progress(UserPrincipal.builder().id(7L).role(role).build(), 1L))
                    .isInstanceOf(AppException.class).extracting("status").isEqualTo(org.springframework.http.HttpStatus.FORBIDDEN);
        verifyNoInteractions(balances, tiers, rewards, vouchers);
    }
}
