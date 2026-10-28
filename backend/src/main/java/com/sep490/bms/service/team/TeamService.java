package com.sep490.bms.service.team;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.sep490.bms.dto.team.CreateTeamRequest;
import com.sep490.bms.dto.team.JoinRequestCreateRequest;
import com.sep490.bms.dto.team.JoinRequestResponse;
import com.sep490.bms.dto.team.TeamMemberResponse;
import com.sep490.bms.dto.team.TeamResponse;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.team.JoinRequestStatus;
import com.sep490.bms.entity.team.Team;
import com.sep490.bms.entity.team.TeamJoinRequest;
import com.sep490.bms.entity.team.TeamMember;
import com.sep490.bms.entity.team.TeamMemberStatus;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.team.TeamJoinRequestRepository;
import com.sep490.bms.repository.team.TeamMemberRepository;
import com.sep490.bms.repository.team.TeamRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TeamService {

    /** Số thành viên tối đa của một đội (DR12). */
    private static final int MAX_TEAM_MEMBERS = 20;

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TeamJoinRequestRepository teamJoinRequestRepository;
    private final AccountRepository accountRepository;

    // ---------------------------------------------------------------- Đội

    @Transactional
    public TeamResponse createTeam(Long userId, CreateTeamRequest request) {
        String name = request.getName().trim();
        if (name.isEmpty()) {
            throw new AppException("Tên đội không được để trống");
        }
        if (teamRepository.existsByNameIgnoreCase(name)) {
            throw new AppException("Tên đội đã tồn tại, vui lòng chọn tên khác", HttpStatus.CONFLICT);
        }

        Team team = teamRepository.save(Team.builder().name(name).captainId(userId).build());
        teamMemberRepository.save(TeamMember.builder()
                .teamId(team.getId())
                .playerId(userId)
                .status(TeamMemberStatus.ACTIVE)
                .build());
        return toTeamResponse(team, userId);
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> getTeams(Long userId, String search) {
        String keyword = StringUtils.hasText(search) ? search.trim() : null;
        return teamRepository.search(keyword).stream().map(t -> toTeamResponse(t, userId)).toList();
    }

    @Transactional(readOnly = true)
    public TeamResponse getTeam(Long userId, Long teamId) {
        return toTeamResponse(findTeam(teamId), userId);
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> getMyTeams(Long userId) {
        return teamRepository.findByActiveMember(userId).stream().map(t -> toTeamResponse(t, userId)).toList();
    }

    // ---------------------------------------------------------------- Thành viên

    @Transactional(readOnly = true)
    public List<TeamMemberResponse> getMembers(Long userId, Long teamId) {
        Team team = findTeam(teamId);
        if (!isActiveMember(teamId, userId)) {
            throw new AppException("Chỉ thành viên của đội mới xem được danh sách thành viên", HttpStatus.FORBIDDEN);
        }

        List<TeamMember> members = teamMemberRepository.findByTeamIdAndStatusOrderByJoinedAtAsc(teamId, TeamMemberStatus.ACTIVE);
        Map<Long, Account> accounts = loadAccounts(members.stream().map(TeamMember::getPlayerId).toList());
        return members.stream().map(m -> {
            Account a = accounts.get(m.getPlayerId());
            return TeamMemberResponse.builder()
                    .id(m.getId())
                    .playerId(m.getPlayerId())
                    .fullName(a.getFullName())
                    .phone(a.getPhone())
                    .skillLevel(a.getSkillLevel())
                    .captain(m.getPlayerId().equals(team.getCaptainId()))
                    .joinedAt(m.getJoinedAt())
                    .build();
        }).toList();
    }

    @Transactional
    public void leaveTeam(Long userId, Long teamId) {
        Team team = findTeam(teamId);
        TeamMember member = teamMemberRepository
                .findByTeamIdAndPlayerIdAndStatus(teamId, userId, TeamMemberStatus.ACTIVE)
                .orElseThrow(() -> new AppException("Bạn không phải thành viên của đội này"));
        if (team.getCaptainId().equals(userId)) {
            throw new AppException("Đội trưởng không thể rời đội");
        }
        member.setStatus(TeamMemberStatus.LEFT);
        member.setLeftAt(LocalDateTime.now());
        teamMemberRepository.save(member);
    }

    @Transactional
    public void removeMember(Long userId, Long memberId) {
        TeamMember member = teamMemberRepository.findById(memberId)
                .orElseThrow(() -> new AppException("Không tìm thấy thành viên", HttpStatus.NOT_FOUND));
        Team team = findTeam(member.getTeamId());
        requireCaptain(team, userId);

        if (member.getStatus() != TeamMemberStatus.ACTIVE) {
            throw new AppException("Thành viên này không còn trong đội");
        }
        if (member.getPlayerId().equals(team.getCaptainId())) {
            throw new AppException("Không thể xóa đội trưởng khỏi đội");
        }
        member.setStatus(TeamMemberStatus.REMOVED);
        member.setLeftAt(LocalDateTime.now());
        teamMemberRepository.save(member);
    }

    // ---------------------------------------------------------------- Yêu cầu vào đội

    @Transactional
    public JoinRequestResponse createJoinRequest(Long userId, Long teamId, JoinRequestCreateRequest request) {
        findTeam(teamId);
        if (!Boolean.TRUE.equals(request.getPhoneConsent())) {
            throw new AppException("Bạn cần đồng ý chia sẻ số điện thoại với đội trưởng để gửi yêu cầu");
        }
        if (isActiveMember(teamId, userId)) {
            throw new AppException("Bạn đã là thành viên của đội này");
        }
        if (teamJoinRequestRepository.existsByTeamIdAndPlayerIdAndStatus(teamId, userId, JoinRequestStatus.PENDING)) {
            throw new AppException("Bạn đã gửi yêu cầu vào đội này và đang chờ duyệt", HttpStatus.CONFLICT);
        }

        TeamJoinRequest saved = teamJoinRequestRepository.save(TeamJoinRequest.builder()
                .teamId(teamId)
                .playerId(userId)
                .phoneConsent(true)
                .build());
        return toJoinRequestResponses(List.of(saved)).get(0);
    }

    @Transactional(readOnly = true)
    public List<JoinRequestResponse> getJoinRequests(Long userId, Long teamId, String status) {
        Team team = findTeam(teamId);
        requireCaptain(team, userId);

        List<TeamJoinRequest> requests = StringUtils.hasText(status)
                ? teamJoinRequestRepository.findByTeamIdAndStatusOrderByCreatedAtDesc(teamId, parseStatus(status))
                : teamJoinRequestRepository.findByTeamIdOrderByCreatedAtDesc(teamId);
        return toJoinRequestResponses(requests);
    }

    @Transactional
    public JoinRequestResponse approveJoinRequest(Long userId, Long requestId) {
        TeamJoinRequest request = findPendingRequest(requestId);
        requireCaptain(findTeam(request.getTeamId()), userId);

        if (teamMemberRepository.countByTeamIdAndStatus(request.getTeamId(), TeamMemberStatus.ACTIVE) >= MAX_TEAM_MEMBERS) {
            throw new AppException("Đội đã đủ " + MAX_TEAM_MEMBERS + " thành viên, không thể duyệt thêm");
        }
        if (!isActiveMember(request.getTeamId(), request.getPlayerId())) {
            teamMemberRepository.save(TeamMember.builder()
                    .teamId(request.getTeamId())
                    .playerId(request.getPlayerId())
                    .status(TeamMemberStatus.ACTIVE)
                    .build());
        }
        return decide(request, JoinRequestStatus.APPROVED);
    }

    @Transactional
    public JoinRequestResponse rejectJoinRequest(Long userId, Long requestId) {
        TeamJoinRequest request = findPendingRequest(requestId);
        requireCaptain(findTeam(request.getTeamId()), userId);
        return decide(request, JoinRequestStatus.REJECTED);
    }

    @Transactional
    public JoinRequestResponse cancelJoinRequest(Long userId, Long requestId) {
        TeamJoinRequest request = findPendingRequest(requestId);
        if (!request.getPlayerId().equals(userId)) {
            throw new AppException("Bạn chỉ có thể hủy yêu cầu của chính mình", HttpStatus.FORBIDDEN);
        }
        return decide(request, JoinRequestStatus.CANCELLED);
    }

    // ---------------------------------------------------------------- Helper

    private JoinRequestResponse decide(TeamJoinRequest request, JoinRequestStatus status) {
        request.setStatus(status);
        request.setDecidedAt(LocalDateTime.now());
        return toJoinRequestResponses(List.of(teamJoinRequestRepository.save(request))).get(0);
    }

    private TeamJoinRequest findPendingRequest(Long requestId) {
        TeamJoinRequest request = teamJoinRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException("Không tìm thấy yêu cầu vào đội", HttpStatus.NOT_FOUND));
        if (request.getStatus() != JoinRequestStatus.PENDING) {
            throw new AppException("Yêu cầu này đã được xử lý");
        }
        return request;
    }

    private Team findTeam(Long teamId) {
        return teamRepository.findById(teamId)
                .orElseThrow(() -> new AppException("Không tìm thấy đội", HttpStatus.NOT_FOUND));
    }

    private void requireCaptain(Team team, Long userId) {
        if (!team.getCaptainId().equals(userId)) {
            throw new AppException("Chỉ đội trưởng mới có quyền thực hiện thao tác này", HttpStatus.FORBIDDEN);
        }
    }

    private boolean isActiveMember(Long teamId, Long userId) {
        return teamMemberRepository.existsByTeamIdAndPlayerIdAndStatus(teamId, userId, TeamMemberStatus.ACTIVE);
    }

    private JoinRequestStatus parseStatus(String status) {
        try {
            return JoinRequestStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("Trạng thái không hợp lệ: " + status);
        }
    }

    private Map<Long, Account> loadAccounts(List<Long> ids) {
        return accountRepository.findAllById(ids).stream().collect(Collectors.toMap(Account::getId, Function.identity()));
    }

    private TeamResponse toTeamResponse(Team team, Long userId) {
        String captainName = accountRepository.findById(team.getCaptainId()).map(Account::getFullName).orElse(null);
        return TeamResponse.builder()
                .id(team.getId())
                .name(team.getName())
                .captainId(team.getCaptainId())
                .captainName(captainName)
                .memberCount(teamMemberRepository.countByTeamIdAndStatus(team.getId(), TeamMemberStatus.ACTIVE))
                .member(isActiveMember(team.getId(), userId))
                .captain(team.getCaptainId().equals(userId))
                .createdAt(team.getCreatedAt())
                .build();
    }

    private List<JoinRequestResponse> toJoinRequestResponses(List<TeamJoinRequest> requests) {
        Map<Long, Account> accounts = loadAccounts(requests.stream().map(TeamJoinRequest::getPlayerId).distinct().toList());
        return requests.stream().map(r -> {
            Account a = accounts.get(r.getPlayerId());
            return JoinRequestResponse.builder()
                    .id(r.getId())
                    .targetId(r.getTeamId())
                    .playerId(r.getPlayerId())
                    .fullName(a.getFullName())
                    .phone(a.getPhone())
                    .skillLevel(a.getSkillLevel())
                    .status(r.getStatus().name())
                    .createdAt(r.getCreatedAt())
                    .decidedAt(r.getDecidedAt())
                    .build();
        }).toList();
    }
}
