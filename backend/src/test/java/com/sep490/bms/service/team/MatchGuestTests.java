package com.sep490.bms.service.team;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import java.util.Optional;
import com.sep490.bms.dto.team.MatchResponse;
import com.sep490.bms.entity.team.JoinRequestStatus;
import com.sep490.bms.entity.team.MatchJoinRequest;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.team.*;
import com.sep490.bms.service.team.MatchNotifier;
import com.sep490.bms.service.team.MatchService;
import org.junit.jupiter.api.Test;

/**
 * Kiểm tra Guest xem được kèo mà thông tin liên hệ riêng của chủ kèo vẫn được bảo vệ.
 */
class MatchGuestTests {
    @Test
    void guestCanViewMatchWithoutHostPhoneOrPersonalJoinQuery() {
        var queries = mock(MatchQueryRepository.class);
        var joins = mock(MatchJoinRequestRepository.class);
        var service = new MatchService(mock(MatchRepository.class), joins, queries,
                mock(TeamRepository.class), mock(AccountRepository.class), mock(MatchNotifier.class),
                mock(BookingRepository.class));
        when(queries.findMatch(1L)).thenReturn(Optional.of(MatchResponse.builder()
                .id(1L).hostId(5L).hostPhone("0987654321").build()));

        var match = service.getMatch(null, 1L);

        assertThat(match.isHost()).isFalse();
        assertThat(match.getMyJoinStatus()).isNull();
        assertThat(match.getMyJoinRequestId()).isNull();
        assertThat(match.getHostPhone()).isNull();
        verifyNoInteractions(joins);
    }

    @Test
    void playerSeesOwnPendingRequestIdToWithdraw() {
        var queries = mock(MatchQueryRepository.class);
        var joins = mock(MatchJoinRequestRepository.class);
        var service = new MatchService(mock(MatchRepository.class), joins, queries,
                mock(TeamRepository.class), mock(AccountRepository.class), mock(MatchNotifier.class),
                mock(BookingRepository.class));
        when(queries.findMatch(1L)).thenReturn(Optional.of(MatchResponse.builder()
                .id(1L).hostId(5L).hostPhone("0987654321").build()));
        when(joins.findFirstByMatchIdAndPlayerIdOrderByCreatedAtDesc(1L, 7L)).thenReturn(Optional.of(
                MatchJoinRequest.builder().id(42L).matchId(1L).playerId(7L).status(JoinRequestStatus.PENDING).build()));

        var match = service.getMatch(7L, 1L);

        assertThat(match.getMyJoinStatus()).isEqualTo("PENDING");
        assertThat(match.getMyJoinRequestId()).isEqualTo(42L);
        assertThat(match.getHostPhone()).isNull();
    }
}
