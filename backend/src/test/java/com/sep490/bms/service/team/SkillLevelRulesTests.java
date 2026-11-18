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

import com.sep490.bms.dto.team.CreateTeamRequest;
import com.sep490.bms.dto.team.JoinRequestCreateRequest;
import com.sep490.bms.dto.team.MatchResponse;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.team.JoinRequestStatus;
import com.sep490.bms.entity.team.Match;
import com.sep490.bms.entity.team.MatchJoinRequest;
import com.sep490.bms.entity.team.MatchStatus;
import com.sep490.bms.entity.team.Team;
import com.sep490.bms.entity.team.TeamJoinRequest;
import com.sep490.bms.entity.team.TeamMemberStatus;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.team.MatchJoinRequestRepository;
import com.sep490.bms.repository.team.MatchQueryRepository;
import com.sep490.bms.repository.team.MatchQueryRepository.JoinConflicts;
import com.sep490.bms.repository.team.MatchRepository;
import com.sep490.bms.repository.team.TeamJoinRequestRepository;
import com.sep490.bms.repository.team.TeamMemberRepository;
import com.sep490.bms.repository.team.TeamRepository;

/**
 * D165, DR33: trình độ 4 mức; đội có trình độ (FR91, FR94); xin vào đội/kèo phải có trình độ (FR92, FR99);
 * DR27 tên đội; BR57/FR93/FR103 số điện thoại người xin chỉ hiện khi đã được duyệt.
 */
class SkillLevelRulesTests {

    private final TeamRepository teams = mock(TeamRepository.class);
    private final TeamMemberRepository members = mock(TeamMemberRepository.class);
    private final TeamJoinRequestRepository teamJoins = mock(TeamJoinRequestRepository.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final TeamService teamService = new TeamService(teams, members, teamJoins, accounts);

    private final MatchRepository matches = mock(MatchRepository.class);
    private final MatchJoinRequestRepository matchJoins = mock(MatchJoinRequestRepository.class);
    private final MatchQueryRepository queries = mock(MatchQueryRepository.class);
    private final MatchService matchService = new MatchService(matches, matchJoins, queries,
            teams, accounts, mock(MatchNotifier.class), mock(BookingRepository.class));

    private static final LocalDate PLAY_DATE = LocalDate.now().plusDays(2);

    private Account player(String skill) {
        Account account = Account.builder().id(7L).fullName("Người xin").phone("0907777777").skillLevel(skill).build();
        when(accounts.findById(7L)).thenReturn(Optional.of(account));
        when(accounts.findAllById(any())).thenReturn(List.of(account));
        return account;
    }

    // ---------------------------------------------------------------- Đội

    @Test
    void createTeamRequiresOneOfFourSkillLevels() {
        assertThatThrownBy(() -> teamService.createTeam(1L,
                CreateTeamRequest.builder().name("Cầu Giấy").skillLevel("Giỏi").build()))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Mới chơi, Trung bình, Khá, Nâng cao");
        verify(teams, never()).save(any());
    }

    @Test
    void createTeamTrimsExtraSpacesAndEnforcesNameLength() {
        assertThatThrownBy(() -> teamService.createTeam(1L,
                CreateTeamRequest.builder().name("  AB ").skillLevel("Khá").build()))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("từ 3 đến 30 ký tự");

        when(teams.save(any())).thenAnswer(i -> {
            Team t = i.getArgument(0);
            t.setId(5L);
            return t;
        });
        var created = teamService.createTeam(1L,
                CreateTeamRequest.builder().name("  Cầu   Giấy  ").skillLevel("Khá").build());
        assertThat(created.getName()).isEqualTo("Cầu Giấy");
        assertThat(created.getSkillLevel()).isEqualTo("Khá");
        verify(teams).existsByNameIgnoreCase("Cầu Giấy");
    }

    @Test
    void teamListFiltersBySkillLevel() {
        when(teams.search(null)).thenReturn(List.of(
                Team.builder().id(1L).name("A team").captainId(1L).skillLevel("Khá").build(),
                Team.builder().id(2L).name("B team").captainId(2L).skillLevel("Mới chơi").build()));

        var result = teamService.getTeams(9L, null, "Khá");

        assertThat(result).extracting("id").containsExactly(1L);
        assertThat(result.get(0).getSkillLevel()).isEqualTo("Khá");
    }

    @Test
    void onlyCaptainChangesTeamSkillLevel() {
        Team team = Team.builder().id(1L).name("A team").captainId(1L).skillLevel("Khá").build();
        when(teams.findById(1L)).thenReturn(Optional.of(team));
        when(teams.save(any())).thenAnswer(i -> i.getArgument(0));

        assertThatThrownBy(() -> teamService.updateSkillLevel(2L, 1L, "Nâng cao"))
                .isInstanceOf(AppException.class);
        assertThat(teamService.updateSkillLevel(1L, 1L, "Nâng cao").getSkillLevel()).isEqualTo("Nâng cao");
    }

    private void stubOpenTeam() {
        when(teams.findById(1L)).thenReturn(Optional.of(Team.builder().id(1L).name("A team").captainId(1L).build()));
        when(members.countByTeamIdAndStatus(1L, TeamMemberStatus.ACTIVE)).thenReturn(3L);
        when(teamJoins.save(any())).thenAnswer(i -> {
            TeamJoinRequest r = i.getArgument(0);
            r.setId(40L);
            r.setStatus(JoinRequestStatus.PENDING);
            return r;
        });
    }

    @Test
    void teamJoinWithoutProfileSkillMustChooseOne() {
        stubOpenTeam();
        player(null);

        assertThatThrownBy(() -> teamService.createJoinRequest(7L, 1L,
                JoinRequestCreateRequest.builder().phoneConsent(true).build()))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("chưa có trình độ");
        verify(teamJoins, never()).save(any());
    }

    @Test
    void teamJoinSavesChosenSkillToProfileAndHidesPhoneWhilePending() {
        stubOpenTeam();
        Account account = player(null);

        var response = teamService.createJoinRequest(7L, 1L,
                JoinRequestCreateRequest.builder().phoneConsent(true).skillLevel("Trung bình").build());

        assertThat(account.getSkillLevel()).isEqualTo("Trung bình");
        verify(accounts).save(account);
        assertThat(response.getSkillLevel()).isEqualTo("Trung bình");
        assertThat(response.getPhone()).isNull();
    }

    @Test
    void teamJoinKeepsExistingProfileSkill() {
        stubOpenTeam();
        Account account = player("Khá");

        teamService.createJoinRequest(7L, 1L,
                JoinRequestCreateRequest.builder().phoneConsent(true).skillLevel("Mới chơi").build());

        assertThat(account.getSkillLevel()).isEqualTo("Khá");
        verify(accounts, never()).save(any());
    }

    // ---------------------------------------------------------------- Kèo

    private void stubOpenMatch() {
        when(matches.findById(1L)).thenReturn(Optional.of(Match.builder()
                .id(1L).bookingId(9L).status(MatchStatus.OPEN).currentPlayers(4).neededPlayers(2).build()));
        when(queries.findMatch(1L)).thenReturn(Optional.of(MatchResponse.builder()
                .id(1L).bookingId(9L).hostId(5L).playDate(PLAY_DATE).startMinute(600).endMinute(660).build()));
        when(matchJoins.existsByMatchIdAndPlayerIdAndStatusIn(eq(1L), eq(7L), anyCollection())).thenReturn(false);
        when(queries.findJoinConflicts(7L, 1L, PLAY_DATE, 600, 660)).thenReturn(new JoinConflicts(0, 0, 0));
        when(matchJoins.save(any())).thenAnswer(i -> {
            MatchJoinRequest r = i.getArgument(0);
            r.setId(42L);
            r.setStatus(JoinRequestStatus.PENDING);
            return r;
        });
    }

    @Test
    void matchJoinWithoutProfileSkillMustChooseOne() {
        stubOpenMatch();
        player(null);

        assertThatThrownBy(() -> matchService.createJoinRequest(7L, 1L,
                JoinRequestCreateRequest.builder().phoneConsent(true).skillLevel("Giỏi").build()))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Trình độ chơi");
        verify(matchJoins, never()).save(any());
    }

    @Test
    void matchJoinSavesSkillAndHostSeesPhoneOnlyAfterApproval() {
        stubOpenMatch();
        Account account = player(null);

        var pending = matchService.createJoinRequest(7L, 1L,
                JoinRequestCreateRequest.builder().phoneConsent(true).skillLevel("Nâng cao").build());

        assertThat(account.getSkillLevel()).isEqualTo("Nâng cao");
        assertThat(pending.getPhone()).isNull();

        when(matchJoins.findByMatchIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(MatchJoinRequest.builder()
                .id(42L).matchId(1L).playerId(7L).status(JoinRequestStatus.APPROVED).build()));
        assertThat(matchService.getJoinRequests(5L, 1L, null).get(0).getPhone()).isEqualTo("0907777777");
    }
}
