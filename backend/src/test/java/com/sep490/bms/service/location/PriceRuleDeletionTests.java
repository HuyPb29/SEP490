package com.sep490.bms.service.location;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.Optional;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.repository.location.*;
import com.sep490.bms.security.UserPrincipal;
import org.junit.jupiter.api.Test;

/** Kiểm tra Owner xóa giá mặc định để cấu hình lại mà không bị chặn bởi yêu cầu phủ kín. */
class PriceRuleDeletionTests {
    @Test void ownerCanRemoveDefaultPriceFromActiveCourtWithoutCancellingExistingBookings() {
        var prices = mock(PriceRuleRepository.class);
        var locations = mock(LocationRepository.class);
        var coverage = mock(PriceCoverageService.class);
        var courts = mock(CourtManagementService.class);
        var ownership = mock(LocationManagementService.class);
        var service = new PriceRuleService(prices, locations, coverage, courts, ownership);
        var owner = UserPrincipal.builder().id(7L).build();
        var location = Location.builder().id(1L).status("ACTIVE").build();
        var rule = PriceRule.builder().id(3L).courtId(2L).build();
        when(locations.findByPriceRuleIdForUpdate(3L)).thenReturn(Optional.of(location));
        when(ownership.requireOwnership(owner, location)).thenReturn(location);
        when(prices.findById(3L)).thenReturn(Optional.of(rule));
        when(courts.requireCourt(2L)).thenReturn(Court.builder().id(2L).active(true).build());
        assertThatCode(() -> service.delete(owner, 3L)).doesNotThrowAnyException();
        verify(prices).delete(rule);
        verifyNoInteractions(coverage);
    }
}
