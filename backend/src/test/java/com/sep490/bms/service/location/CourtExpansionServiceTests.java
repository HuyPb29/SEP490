package com.sep490.bms.service.location;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import com.sep490.bms.dto.location.CourtExpansionDtos.*;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.*;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.notification.NotificationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CourtExpansionServiceTests {
    private final CourtExpansionRepository requests = mock(CourtExpansionRepository.class);
    private final LocationRepository locations = mock(LocationRepository.class);
    private final CourtRepository courts = mock(CourtRepository.class);
    private final CourtExpansionService service = new CourtExpansionService(requests, locations,
            mock(ServiceTermRepository.class), courts, mock(LocationManagementService.class),
            mock(FileStorageService.class), mock(NotificationService.class), mock(AccountRepository.class),
            mock(jakarta.persistence.EntityManager.class));
    private final UserPrincipal admin = UserPrincipal.builder().id(1L).role(Role.ADMIN).build();

    @Test void chargesInclusiveDaysAndRoundsOnlyTotalUp() {
        Quote q = CourtExpansionService.calculate(2, LocalDate.of(2026,11,20), LocalDate.of(2026,12,31), new BigDecimal("10000000"));
        assertThat(q.days()).isEqualTo(42);
        assertThat(q.amount()).isEqualByComparingTo("256000");
        assertThat(CourtExpansionService.calculate(9, LocalDate.of(2026,1,1), LocalDate.of(2026,12,31), new BigDecimal("10000000")).amount())
                .isEqualByComparingTo("10000000");
    }
    @Test void noDaysLeftCannotBeApproved() {
        assertThatThrownBy(() -> CourtExpansionService.calculate(1, LocalDate.of(2026,12,2), LocalDate.of(2026,12,1), BigDecimal.TEN))
                .isInstanceOf(AppException.class);
    }
    @Test void excessMustBeRefundedAndHaveBankReference() {
        assertThatThrownBy(() -> CourtExpansionService.verifySettlement(new BigDecimal("1000"),
                new Decision(new BigDecimal("2000"), BigDecimal.ZERO, "", null, null, null))).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> CourtExpansionService.verifySettlement(new BigDecimal("1000"),
                new Decision(new BigDecimal("2000"), new BigDecimal("1000"), "", null, null, null))).isInstanceOf(AppException.class);
        assertThatCode(() -> CourtExpansionService.verifySettlement(new BigDecimal("1000"),
                new Decision(new BigDecimal("2000"), new BigDecimal("1000"), "Hoàn qua ngân hàng, mã GD123", null, null, null))).doesNotThrowAnyException();
    }
    @Test void underpaymentAndPartialRefundOnRejectionAreBlocked() {
        assertThatThrownBy(() -> CourtExpansionService.verifySettlement(BigDecimal.TEN,
                new Decision(BigDecimal.ONE, BigDecimal.ZERO, null, null, null, null))).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> CourtExpansionService.verifySettlement(BigDecimal.ZERO,
                new Decision(BigDecimal.TEN, BigDecimal.ONE, "GD123", "Từ chối", null, null))).isInstanceOf(AppException.class);
    }
    private CourtExpansion pending() {
        CourtExpansion r = CourtExpansion.builder().id(7L).locationId(2L).ownerId(9L).courtCount(2)
                .referenceFee(new BigDecimal("10000000")).quotedStart(LocalDate.now().minusDays(2))
                .contractEnd(LocalDate.now().plusDays(42)).quotedAmount(new BigDecimal("300000"))
                .status(ApprovalStatus.PENDING).createdAt(LocalDateTime.now().minusDays(3)).build();
        when(requests.findById(7L)).thenReturn(Optional.of(r));
        when(requests.findByIdForUpdate(7L)).thenReturn(Optional.of(r));
        Location location = Location.builder().id(2L).ownerId(9L).name("Địa điểm A").status("ACTIVE").build();
        when(locations.findByIdForUpdate(2L)).thenReturn(Optional.of(location));
        when(locations.findById(2L)).thenReturn(Optional.of(location));
        when(courts.findAllByLocationIdOrderByNameAsc(2L)).thenReturn(List.of(Court.builder().name("Sân 1").build()));
        return r;
    }
    @Test void lateApprovalRepricesRefundsAndCreatesExactlyRequestedCourtsFromTomorrow() {
        CourtExpansion r = pending();
        Quote q = CourtExpansionService.calculate(2, LocalDate.now().plusDays(1), r.getContractEnd(), r.getReferenceFee());
        service.decide(admin, 7L, new Decision(r.getQuotedAmount(), r.getQuotedAmount().subtract(q.amount()),
                "Hoàn GD123", null, q.startDate(), q.amount()), true);
        assertThat(r.getStatus()).isEqualTo(ApprovalStatus.APPROVED);
        assertThat(r.getFinalAmount()).isEqualByComparingTo(q.amount());
        ArgumentCaptor<Court> created = ArgumentCaptor.forClass(Court.class);
        verify(courts, times(2)).save(created.capture());
        assertThat(created.getAllValues()).extracting(Court::getName).containsExactly("Sân 2", "Sân 3");
        assertThat(created.getAllValues()).allSatisfy(c -> {
            assertThat(c.isActive()).isFalse();
            assertThat(c.getAvailableFrom()).isEqualTo(LocalDate.now().plusDays(1));
        });
    }
    @Test void approvalIsNotRepeatableAndStaleQuoteCannotBeConfirmed() {
        CourtExpansion r = pending();
        assertThatThrownBy(() -> service.decide(admin, 7L, new Decision(BigDecimal.TEN, BigDecimal.ZERO,
                null, null, LocalDate.now(), BigDecimal.TEN), true)).isInstanceOf(AppException.class);
        verify(courts, never()).save(any());
        r.setStatus(ApprovalStatus.APPROVED);
        assertThatThrownBy(() -> service.decide(admin, 7L, null, true)).isInstanceOf(AppException.class);
        verify(courts, never()).save(any());
    }
}
