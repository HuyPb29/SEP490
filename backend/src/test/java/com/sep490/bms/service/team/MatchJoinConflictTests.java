package com.sep490.bms.service.team;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.sep490.bms.dto.team.JoinRequestCreateRequest;
import com.sep490.bms.dto.team.MatchResponse;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.team.JoinRequestStatus;
import com.sep490.bms.entity.team.Match;
import com.sep490.bms.entity.team.MatchJoinRequest;
import com.sep490.bms.entity.team.MatchStatus;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.team.MatchJoinRequestRepository;
import com.sep490.bms.repository.team.MatchQueryRepository;
import com.sep490.bms.repository.team.MatchQueryRepository.JoinConflicts;
import com.sep490.bms.repository.team.MatchRepository;
import com.sep490.bms.repository.team.TeamRepository;

/**
 * D61: không tham gia hai kèo trùng giờ, không xin kèo trùng giờ với booking của mình.
 * D62: mỗi khung giờ chỉ một yêu cầu đang chờ; muốn xin kèo khác phải rút yêu cầu cũ.
 */
class MatchJoinConflictTests {

    private final MatchRepository matches = mock(MatchRepository.class);
    private final MatchJoinRequestRepository joins = mock(MatchJoinRequestRepository.class);
    private final MatchQueryRepository queries = mock(MatchQueryRepository.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final MatchService service = new MatchService(matches, joins, queries,
            mock(TeamRepository.class), accounts, mock(MatchNotifier.class), mock(BookingRepository.class));

    private static final LocalDate PLAY_DATE = LocalDate.now().plusDays(2);

    private void stubOpenMatch() {
        when(matches.findById(1L)).thenReturn(Optional.of(Match.builder()
                .id(1L).bookingId(9L).status(MatchStatus.OPEN).currentPlayers(4).neededPlayers(2).build()));
        when(queries.findMatch(1L)).thenReturn(Optional.of(MatchResponse.builder()
                .id(1L).bookingId(9L).hostId(5L).playDate(PLAY_DATE).startMinute(600).endMinute(660).build()));
        when(joins.existsByMatchIdAndPlayerIdAndStatusIn(eq(1L), eq(7L), anyCollection())).thenReturn(false);
    }

    private void stubConflicts(long approvedMatches, long pendingRequests, long ownBookings) {
        when(queries.findJoinConflicts(7L, 1L, PLAY_DATE, 600, 660))
                .thenReturn(new JoinConflicts(approvedMatches, pendingRequests, ownBookings));
    }

    private JoinRequestCreateRequest consent() {
        return JoinRequestCreateRequest.builder().phoneConsent(true).build();
    }

    @Test
    void rejectsJoinWhenAlreadyInOverlappingMatch() {
        stubOpenMatch();
        stubConflicts(1, 0, 0);

        assertThatThrownBy(() -> service.createJoinRequest(7L, 1L, consent()))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("kèo khác trùng giờ");
        verify(joins, never()).save(any());
    }

    @Test
    void rejectsJoinWhenOwnBookingOverlaps() {
        stubOpenMatch();
        stubConflicts(0, 0, 1);

        assertThatThrownBy(() -> service.createJoinRequest(7L, 1L, consent()))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("booking trùng giờ");
        verify(joins, never()).save(any());
    }

    @Test
    void rejectsJoinWhenAnotherPendingRequestSameSlot() {
        stubOpenMatch();
        stubConflicts(0, 1, 0);

        assertThatThrownBy(() -> service.createJoinRequest(7L, 1L, consent()))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("rút yêu cầu");
        verify(joins, never()).save(any());
    }

    @Test
    void allowsJoinWhenNoTimeConflict() {
        stubOpenMatch();
        stubConflicts(0, 0, 0);
        MatchJoinRequest saved = MatchJoinRequest.builder()
                .id(42L).matchId(1L).playerId(7L).status(JoinRequestStatus.PENDING).build();
        when(joins.save(any())).thenReturn(saved);
        Account account = mock(Account.class);
        when(account.getId()).thenReturn(7L);
        when(accounts.findAllById(any())).thenReturn(List.of(account));

        var response = service.createJoinRequest(7L, 1L, consent());

        assertThat(response.getId()).isEqualTo(42L);
    }

    /** D61 kiểm lại lúc duyệt: sau khi gửi yêu cầu, Player có thể đã vào kèo khác hoặc đặt booking trùng giờ. */
    @Test
    void approveRejectsWhenPlayerGainedOverlapAfterRequesting() {
        when(joins.findByIdForUpdate(42L)).thenReturn(Optional.of(MatchJoinRequest.builder()
                .id(42L).matchId(1L).playerId(7L).status(JoinRequestStatus.PENDING).build()));
        when(queries.findMatch(1L)).thenReturn(Optional.of(MatchResponse.builder()
                .id(1L).bookingId(9L).hostId(5L).playDate(PLAY_DATE).startMinute(600).endMinute(660).build()));
        when(matches.findByIdForUpdate(1L)).thenReturn(Optional.of(Match.builder()
                .id(1L).bookingId(9L).status(MatchStatus.OPEN).currentPlayers(4).neededPlayers(2).build()));
        when(queries.findJoinConflicts(7L, 1L, PLAY_DATE, 600, 660))
                .thenReturn(new JoinConflicts(0, 0, 1));

        assertThatThrownBy(() -> service.approveJoinRequest(5L, 42L))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("trùng giờ");
        verify(matches, never()).saveAndFlush(any());
        verify(joins, never()).save(any());
    }
}
