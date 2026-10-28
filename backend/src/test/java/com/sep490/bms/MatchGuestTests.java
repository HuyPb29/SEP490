package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import java.util.Optional;
import com.sep490.bms.dto.team.MatchResponse;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.team.*;
import com.sep490.bms.service.team.MatchService;
import org.junit.jupiter.api.Test;

class MatchGuestTests {
    @Test
    void guestCanViewMatchWithoutHostPhoneOrPersonalJoinQuery() {
        var queries = mock(MatchQueryRepository.class);
        var joins = mock(MatchJoinRequestRepository.class);
        var service = new MatchService(mock(MatchRepository.class), joins, queries,
                mock(TeamRepository.class), mock(AccountRepository.class));
        when(queries.findMatch(1L)).thenReturn(Optional.of(MatchResponse.builder()
                .id(1L).hostId(5L).hostPhone("0987654321").build()));

        var match = service.getMatch(null, 1L);

        assertThat(match.isHost()).isFalse();
        assertThat(match.getMyJoinStatus()).isNull();
        assertThat(match.getHostPhone()).isNull();
        verifyNoInteractions(joins);
    }
}
