package com.sep490.bms.service.team;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.sep490.bms.entity.team.Team;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.team.TeamJoinRequestRepository;
import com.sep490.bms.repository.team.TeamMemberRepository;
import com.sep490.bms.repository.team.TeamRepository;

/** TeamService.isCaptain dùng khi đặt sân cho đội (BR09, DR03). */
class TeamServiceCaptainTests {

    private final TeamRepository teams = mock(TeamRepository.class);
    private final TeamService service = new TeamService(teams, mock(TeamMemberRepository.class),
            mock(TeamJoinRequestRepository.class), mock(AccountRepository.class));

    @Test
    void captainOfTeamIsCaptain() {
        when(teams.findById(1L)).thenReturn(Optional.of(Team.builder().id(1L).captainId(7L).build()));

        assertThat(service.isCaptain(1L, 7L)).isTrue();
    }

    @Test
    void memberWhoIsNotCaptainIsNot() {
        when(teams.findById(1L)).thenReturn(Optional.of(Team.builder().id(1L).captainId(7L).build()));

        assertThat(service.isCaptain(1L, 8L)).isFalse();
    }

    @Test
    void missingTeamIsNotCaptain() {
        when(teams.findById(99L)).thenReturn(Optional.empty());

        assertThat(service.isCaptain(99L, 7L)).isFalse();
    }
}
