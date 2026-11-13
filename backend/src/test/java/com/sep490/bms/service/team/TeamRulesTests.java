package com.sep490.bms.service.team;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.sep490.bms.dto.team.JoinRequestCreateRequest;
import com.sep490.bms.dto.team.TeamMemberResponse;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.team.Team;
import com.sep490.bms.entity.team.TeamMember;
import com.sep490.bms.entity.team.TeamMemberStatus;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.team.TeamJoinRequestRepository;
import com.sep490.bms.repository.team.TeamMemberRepository;
import com.sep490.bms.repository.team.TeamRepository;

/**
 * D79: chỉ chủ đội xem số điện thoại của thành viên.
 */
class TeamRulesTests {

    private final TeamRepository teams = mock(TeamRepository.class);
    private final TeamMemberRepository members = mock(TeamMemberRepository.class);
    private final TeamJoinRequestRepository joins = mock(TeamJoinRequestRepository.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final TeamService service = new TeamService(teams, members, joins, accounts);

    private void stubTeamWithTwoMembers() {
        when(teams.findById(1L)).thenReturn(Optional.of(Team.builder().id(1L).name("Cầu Giấy").captainId(1L).build()));
        when(members.findByTeamIdAndStatusOrderByJoinedAtAsc(1L, TeamMemberStatus.ACTIVE)).thenReturn(List.of(
                TeamMember.builder().id(11L).teamId(1L).playerId(1L).status(TeamMemberStatus.ACTIVE).build(),
                TeamMember.builder().id(12L).teamId(1L).playerId(2L).status(TeamMemberStatus.ACTIVE).build()));
        Account captain = mock(Account.class);
        when(captain.getId()).thenReturn(1L);
        when(captain.getPhone()).thenReturn("0901111111");
        Account member = mock(Account.class);
        when(member.getId()).thenReturn(2L);
        when(member.getPhone()).thenReturn("0902222222");
        when(accounts.findAllById(any())).thenReturn(List.of(captain, member));
    }

    private void stubActiveMember(Long playerId) {
        when(members.existsByTeamIdAndPlayerIdAndStatus(1L, playerId, TeamMemberStatus.ACTIVE)).thenReturn(true);
    }

    @Test
    void captainSeesAllMemberPhones() {
        stubTeamWithTwoMembers();
        stubActiveMember(1L);

        List<TeamMemberResponse> result = service.getMembers(1L, 1L);

        assertThat(result).extracting(TeamMemberResponse::getPhone)
                .containsExactly("0901111111", "0902222222");
    }

    @Test
    void memberSeesOnlyOwnPhone() {
        stubTeamWithTwoMembers();
        stubActiveMember(2L);

        List<TeamMemberResponse> result = service.getMembers(2L, 1L);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getPhone()).isNull();
        assertThat(result.get(1).getPhone()).isEqualTo("0902222222");
    }

}
