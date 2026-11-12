package com.sep490.bms.service.promotion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.sep490.bms.entity.promotion.PlayerLocationBalance;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.promotion.LoyaltyAccrualRepository;
import com.sep490.bms.repository.promotion.PlayerLocationBalanceRepository;
import com.sep490.bms.repository.promotion.PointTransactionRepository;
import com.sep490.bms.repository.promotion.VoucherUsageRepository;
import com.sep490.bms.security.LocationAccessService;

import jakarta.persistence.EntityManager;

/** Trần điểm 50% (BR41, D161), không cần database. */
class LoyaltyPointPreviewTests {

    private static final Long PLAYER = 7L;
    private static final Long LOCATION = 1L;

    private final PlayerLocationBalanceRepository balances = mock(PlayerLocationBalanceRepository.class);
    private final LoyaltyPointService service = new LoyaltyPointService(balances, mock(PointTransactionRepository.class),
            mock(LoyaltyAccrualRepository.class), mock(VoucherUsageRepository.class), mock(LoyaltyMilestoneService.class),
            mock(LocationAccessService.class), mock(EntityManager.class), null, null);

    @BeforeEach
    void playerHasManyPoints() {
        balance(1000);
    }

    @Test
    void exactlyHalfIsAllowed() {
        assertThat(preview("100000", 100)).isEqualByComparingTo("50000");
    }

    @Test
    void overHalfIsMsg38WithMaxPoints() {
        assertThatThrownBy(() -> preview("100000", 101))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("tối đa 100 điểm")
                .hasMessageContaining("MSG38");
    }

    @Test
    void campaignCapCanBlockPointsOrSetAnotherPercentage() {
        BigDecimal afterVoucher = new BigDecimal("100000");
        assertThatThrownBy(() -> service.preview(PLAYER, LOCATION, afterVoucher, 2, 0))
                .hasMessageContaining("MSG40");
        assertThat(service.preview(PLAYER, LOCATION, afterVoucher, 50, 25)).isEqualByComparingTo("25000");
        assertThatThrownBy(() -> service.preview(PLAYER, LOCATION, afterVoucher, 51, 25))
                .hasMessageContaining("tối đa 50 điểm");
        assertThatThrownBy(() -> service.preview(PLAYER, LOCATION, afterVoucher, 200, 100))
                .hasMessageContaining("tối đa 199 điểm");
    }

    @Test
    void capRoundsDownToWholePoints() {
        assertThat(preview("130000", 130)).isEqualByComparingTo("65000");
        assertThat(preview("130100", 130)).isEqualByComparingTo("65000");
        assertThatThrownBy(() -> preview("130100", 131)).hasMessageContaining("tối đa 130 điểm");
    }

    @Test
    void lessThanTwoPointsIsMsg37() {
        assertThatThrownBy(() -> preview("100000", 1)).hasMessageContaining("MSG37");
    }

    @Test
    void moreThanBalanceIsMsg37() {
        balance(3);

        assertThatThrownBy(() -> preview("100000", 4)).hasMessageContaining("MSG37");
    }

    @Test
    void noBalanceRowMeansZeroPoints() {
        when(balances.findByPlayerIdAndLocationId(PLAYER, LOCATION)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> preview("100000", 2)).hasMessageContaining("MSG37");
    }

    private BigDecimal preview(String amount, int points) {
        return service.preview(PLAYER, LOCATION, new BigDecimal(amount), points);
    }

    private void balance(int points) {
        when(balances.findByPlayerIdAndLocationId(PLAYER, LOCATION)).thenReturn(
                Optional.of(PlayerLocationBalance.builder().playerId(PLAYER).locationId(LOCATION).pointBalance(points).build()));
    }
}
