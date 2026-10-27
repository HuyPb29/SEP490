package com.sep490.bms.service.team;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.team.CreateMatchRequest;
import com.sep490.bms.dto.team.JoinRequestCreateRequest;
import com.sep490.bms.dto.team.JoinRequestResponse;
import com.sep490.bms.dto.team.MatchResponse;
import com.sep490.bms.dto.team.UpdateMatchRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.team.JoinRequestStatus;
import com.sep490.bms.entity.team.Match;
import com.sep490.bms.entity.team.MatchJoinRequest;
import com.sep490.bms.entity.team.MatchStatus;
import com.sep490.bms.entity.team.Team;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.team.MatchJoinRequestRepository;
import com.sep490.bms.repository.team.MatchQueryRepository;
import com.sep490.bms.repository.team.MatchQueryRepository.BookingInfo;
import com.sep490.bms.repository.team.MatchRepository;
import com.sep490.bms.repository.team.TeamRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MatchService {

    /** Tổng số người của một kèo tối đa 8 (ck_match_players). */
    private static final int MAX_PLAYERS = 8;

    private final MatchRepository matchRepository;
    private final MatchJoinRequestRepository matchJoinRequestRepository;
    private final MatchQueryRepository matchQueryRepository;
    private final TeamRepository teamRepository;
    private final AccountRepository accountRepository;

    // ---------------------------------------------------------------- UC28 – Quản lý kèo

    @Transactional
    public MatchResponse createMatch(Long userId, CreateMatchRequest request) {
        BookingInfo booking = matchQueryRepository.findBooking(request.getBookingId())
                .orElseThrow(() -> new AppException("Không tìm thấy booking", HttpStatus.NOT_FOUND));
        if (booking.getTeamId() == null) {
            throw new AppException("Chỉ booking đặt dưới tên một đội mới mở được kèo (BR55)");
        }
        Team team = teamRepository.findById(booking.getTeamId())
                .orElseThrow(() -> new AppException("Không tìm thấy đội của booking", HttpStatus.NOT_FOUND));
        if (!team.getCaptainId().equals(userId)) {
            throw new AppException("Chỉ đội trưởng mới được mở kèo từ booking của đội", HttpStatus.FORBIDDEN);
        }
        if (!"CONFIRMED".equals(booking.getStatus())) {
            throw new AppException("Chỉ booking đã được xác nhận mới mở được kèo");
        }
        if (hasStarted(booking.getPlayDate(), booking.getStartMinute())) {
            throw new AppException("Booking đã bắt đầu hoặc đã qua, không thể mở kèo");
        }
        if (matchRepository.existsByBookingIdAndStatusIn(booking.getId(), Set.of(MatchStatus.OPEN, MatchStatus.CLOSED))) {
            throw new AppException("Booking này đã có kèo đang hoạt động", HttpStatus.CONFLICT);
        }
        validatePlayers(request.getCurrentPlayers(), request.getNeededPlayers());

        Match match = matchRepository.save(Match.builder()
                .bookingId(booking.getId())
                .currentPlayers(request.getCurrentPlayers())
                .neededPlayers(request.getNeededPlayers())
                .status(MatchStatus.OPEN)
                .build());
        return getMatch(userId, match.getId());
    }

    @Transactional
    public MatchResponse updateMatch(Long userId, Long matchId, UpdateMatchRequest request) {
        Match match = findMatch(matchId);
        requireHost(userId, matchId);
        if (match.getStatus() != MatchStatus.OPEN) {
            throw new AppException("Chỉ sửa được kèo đang mở");
        }
        if (request.getCurrentPlayers() == null && request.getNeededPlayers() == null) {
            throw new AppException("Không có thông tin nào để cập nhật");
        }

        int current = request.getCurrentPlayers() != null ? request.getCurrentPlayers() : match.getCurrentPlayers();
        int needed = request.getNeededPlayers() != null ? request.getNeededPlayers() : match.getNeededPlayers();
        validatePlayers(current, needed);

        match.setCurrentPlayers(current);
        match.setNeededPlayers(needed);
        matchRepository.saveAndFlush(match);
        return getMatch(userId, matchId);
    }

    @Transactional
    public MatchResponse closeMatch(Long userId, Long matchId) {
        Match match = findMatch(matchId);
        requireHost(userId, matchId);
        if (match.getStatus() != MatchStatus.OPEN) {
            throw new AppException("Chỉ đóng được kèo đang mở");
        }
        match.setStatus(MatchStatus.CLOSED);
        match.setClosedAt(LocalDateTime.now());
        matchRepository.saveAndFlush(match);
        return getMatch(userId, matchId);
    }

    @Transactional
    public MatchResponse cancelMatch(Long userId, Long matchId) {
        Match match = findMatch(matchId);
        requireHost(userId, matchId);
        if (match.getStatus() != MatchStatus.OPEN && match.getStatus() != MatchStatus.CLOSED) {
            throw new AppException("Kèo này đã kết thúc, không thể hủy");
        }
        match.setStatus(MatchStatus.CANCELLED);
        match.setClosedAt(LocalDateTime.now());
        matchRepository.saveAndFlush(match);

        // Các yêu cầu chưa được duyệt không còn ý nghĩa nữa.
        List<MatchJoinRequest> pending = matchJoinRequestRepository.findByMatchIdAndStatus(matchId, JoinRequestStatus.PENDING);
        pending.forEach(r -> {
            r.setStatus(JoinRequestStatus.CANCELLED);
            r.setDecidedAt(LocalDateTime.now());
        });
        matchJoinRequestRepository.saveAll(pending);
        return getMatch(userId, matchId);
    }

    @Transactional(readOnly = true)
    public List<JoinRequestResponse> getJoinRequests(Long userId, Long matchId, String status) {
        findMatch(matchId);
        requireHost(userId, matchId);

        List<MatchJoinRequest> requests = StringUtils.hasText(status)
                ? matchJoinRequestRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(matchId, parseStatus(status))
                : matchJoinRequestRepository.findByMatchIdOrderByCreatedAtDesc(matchId);
        return toJoinRequestResponses(requests);
    }

    @Transactional
    public JoinRequestResponse approveJoinRequest(Long userId, Long requestId) {
        MatchJoinRequest request = findPendingRequest(requestId);
        Match match = findMatch(request.getMatchId());
        requireHost(userId, match.getId());
        if (match.getStatus() != MatchStatus.OPEN) {
            throw new AppException("Kèo không còn mở, không thể duyệt thêm người");
        }

        if (match.getNeededPlayers() < 1) {
            throw new AppException("Kèo đã đủ người, không thể duyệt thêm");
        }
        match.setCurrentPlayers(match.getCurrentPlayers() + 1);
        match.setNeededPlayers(match.getNeededPlayers() - 1);
        // Người cuối cùng được duyệt thì kèo đầy và tự đóng.
        if (match.getNeededPlayers() == 0) {
            match.setStatus(MatchStatus.CLOSED);
            match.setClosedAt(LocalDateTime.now());
        }
        matchRepository.save(match);
        return decide(request, JoinRequestStatus.APPROVED);
    }

    @Transactional
    public JoinRequestResponse rejectJoinRequest(Long userId, Long requestId) {
        MatchJoinRequest request = findPendingRequest(requestId);
        requireHost(userId, request.getMatchId());
        return decide(request, JoinRequestStatus.REJECTED);
    }

    // ---------------------------------------------------------------- UC29 – Xem thông tin kèo

    @Transactional(readOnly = true)
    public PageResponse<MatchResponse> getMatches(Long userId, String status, Long locationId, LocalDate playDate,
                                                  int page, int size) {
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.min(Math.max(size, 1), 50);
        String statusFilter = StringUtils.hasText(status) ? parseMatchStatus(status).name() : MatchStatus.OPEN.name();
        boolean upcomingOnly = MatchStatus.OPEN.name().equals(statusFilter);

        List<MatchResponse> content = matchQueryRepository
                .searchMatches(statusFilter, locationId, playDate, upcomingOnly, pageNumber * pageSize, pageSize)
                .stream().map(m -> enrich(m, userId)).toList();
        long total = matchQueryRepository.countMatches(statusFilter, locationId, playDate, upcomingOnly);
        int totalPages = (int) Math.ceil((double) total / pageSize);

        return PageResponse.<MatchResponse>builder()
                .content(content)
                .pageNumber(pageNumber)
                .pageSize(pageSize)
                .totalElements(total)
                .totalPages(totalPages)
                .isLast(pageNumber + 1 >= totalPages)
                .build();
    }

    @Transactional(readOnly = true)
    public MatchResponse getMatch(Long userId, Long matchId) {
        MatchResponse match = matchQueryRepository.findMatch(matchId)
                .orElseThrow(() -> new AppException("Không tìm thấy kèo", HttpStatus.NOT_FOUND));
        return enrich(match, userId);
    }

    // ---------------------------------------------------------------- UC30 – Tham gia kèo

    @Transactional
    public JoinRequestResponse createJoinRequest(Long userId, Long matchId, JoinRequestCreateRequest request) {
        Match match = findMatch(matchId);
        if (!Boolean.TRUE.equals(request.getPhoneConsent())) {
            throw new AppException("Bạn cần đồng ý chia sẻ số điện thoại với chủ kèo để tham gia");
        }
        MatchResponse view = matchQueryRepository.findMatch(matchId)
                .orElseThrow(() -> new AppException("Không tìm thấy kèo", HttpStatus.NOT_FOUND));
        if (match.getStatus() != MatchStatus.OPEN) {
            throw new AppException("Kèo này đã đóng hoặc đã hủy");
        }
        if (hasStarted(view.getPlayDate(), view.getStartMinute())) {
            throw new AppException("Kèo đã bắt đầu hoặc đã qua");
        }
        if (view.getHostId().equals(userId)) {
            throw new AppException("Bạn là chủ kèo, không cần gửi yêu cầu tham gia");
        }
        // Mỗi người chỉ được gửi một lần cho tới khi yêu cầu bị hủy (ux_mjoin_once).
        if (matchJoinRequestRepository.existsByMatchIdAndPlayerIdAndStatusIn(matchId, userId,
                Set.of(JoinRequestStatus.PENDING, JoinRequestStatus.APPROVED, JoinRequestStatus.REJECTED))) {
            throw new AppException("Bạn đã gửi yêu cầu tham gia kèo này rồi", HttpStatus.CONFLICT);
        }

        MatchJoinRequest saved = matchJoinRequestRepository.save(MatchJoinRequest.builder()
                .matchId(matchId)
                .playerId(userId)
                .phoneConsent(true)
                .build());
        return toJoinRequestResponses(List.of(saved)).get(0);
    }

    @Transactional
    public JoinRequestResponse cancelJoinRequest(Long userId, Long requestId) {
        MatchJoinRequest request = findPendingRequest(requestId);
        if (!request.getPlayerId().equals(userId)) {
            throw new AppException("Bạn chỉ có thể hủy yêu cầu của chính mình", HttpStatus.FORBIDDEN);
        }
        return decide(request, JoinRequestStatus.CANCELLED);
    }

    // ---------------------------------------------------------------- Helper

    private MatchResponse enrich(MatchResponse match, Long userId) {
        boolean isHost = match.getHostId().equals(userId);
        String myJoinStatus = userId == null ? null : matchJoinRequestRepository
                .findFirstByMatchIdAndPlayerIdOrderByCreatedAtDesc(match.getId(), userId)
                .map(r -> r.getStatus().name())
                .orElse(null);

        match.setHost(isHost);
        match.setMyJoinStatus(myJoinStatus);
        if (!isHost && !JoinRequestStatus.APPROVED.name().equals(myJoinStatus)) {
            match.setHostPhone(null);
        }
        return match;
    }

    private JoinRequestResponse decide(MatchJoinRequest request, JoinRequestStatus status) {
        request.setStatus(status);
        request.setDecidedAt(LocalDateTime.now());
        return toJoinRequestResponses(List.of(matchJoinRequestRepository.save(request))).get(0);
    }

    private MatchJoinRequest findPendingRequest(Long requestId) {
        MatchJoinRequest request = matchJoinRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException("Không tìm thấy yêu cầu tham gia kèo", HttpStatus.NOT_FOUND));
        if (request.getStatus() != JoinRequestStatus.PENDING) {
            throw new AppException("Yêu cầu này đã được xử lý");
        }
        return request;
    }

    private Match findMatch(Long matchId) {
        return matchRepository.findById(matchId)
                .orElseThrow(() -> new AppException("Không tìm thấy kèo", HttpStatus.NOT_FOUND));
    }

    private void requireHost(Long userId, Long matchId) {
        MatchResponse view = matchQueryRepository.findMatch(matchId)
                .orElseThrow(() -> new AppException("Không tìm thấy kèo", HttpStatus.NOT_FOUND));
        if (!view.getHostId().equals(userId)) {
            throw new AppException("Chỉ chủ kèo mới có quyền thực hiện thao tác này", HttpStatus.FORBIDDEN);
        }
    }

    private void validatePlayers(int current, int needed) {
        if (current + needed > MAX_PLAYERS) {
            throw new AppException("Tổng số người của kèo tối đa là " + MAX_PLAYERS);
        }
    }

    private boolean hasStarted(LocalDate playDate, int startMinute) {
        return !playDate.atTime(LocalTime.MIDNIGHT).plusMinutes(startMinute).isAfter(LocalDateTime.now());
    }

    private JoinRequestStatus parseStatus(String status) {
        try {
            return JoinRequestStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("Trạng thái không hợp lệ: " + status);
        }
    }

    private MatchStatus parseMatchStatus(String status) {
        try {
            return MatchStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("Trạng thái không hợp lệ: " + status);
        }
    }

    private List<JoinRequestResponse> toJoinRequestResponses(List<MatchJoinRequest> requests) {
        Map<Long, Account> accounts = accountRepository
                .findAllById(requests.stream().map(MatchJoinRequest::getPlayerId).distinct().toList())
                .stream().collect(Collectors.toMap(Account::getId, Function.identity()));
        return requests.stream().map(r -> {
            Account a = accounts.get(r.getPlayerId());
            return JoinRequestResponse.builder()
                    .id(r.getId())
                    .targetId(r.getMatchId())
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
