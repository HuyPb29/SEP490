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
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.team.JoinRequestStatus;
import com.sep490.bms.entity.team.Match;
import com.sep490.bms.entity.team.MatchJoinRequest;
import com.sep490.bms.entity.team.MatchStatus;
import com.sep490.bms.entity.team.Team;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.team.MatchJoinRequestRepository;
import com.sep490.bms.repository.team.MatchQueryRepository;
import com.sep490.bms.repository.team.MatchQueryRepository.BookingInfo;
import com.sep490.bms.repository.team.MatchQueryRepository.JoinConflicts;
import com.sep490.bms.repository.team.MatchQueryRepository.MatchFilter;
import com.sep490.bms.repository.team.MatchRepository;
import com.sep490.bms.repository.team.TeamRepository;

import lombok.RequiredArgsConstructor;

/**
 * Quản lý kèo từ booking, xét yêu cầu tham gia và xử lý kèo sau khi đổi lịch.
 */
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
    private final MatchNotifier matchNotifier;
    private final BookingRepository bookingRepository;

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
        endMatch(match, MatchStatus.CLOSED, true);
        return getMatch(userId, matchId);
    }

    @Transactional
    public MatchResponse cancelMatch(Long userId, Long matchId) {
        Match match = lockMatchForHost(userId, matchId);
        if (match.getStatus() != MatchStatus.OPEN && match.getStatus() != MatchStatus.CLOSED) {
            throw new AppException("Kèo này đã kết thúc, không thể hủy");
        }
        endMatch(match, MatchStatus.CANCELLED, true);
        return getMatch(userId, matchId);
    }

    @Transactional
    public MatchResponse keepRescheduledMatch(Long userId, Long matchId) {
        Match match = lockMatchForHost(userId, matchId);
        if (!match.isReschedulePending() || !Set.of(MatchStatus.OPEN, MatchStatus.CLOSED).contains(match.getStatus())) {
            throw new AppException("Kèo không chờ quyết định sau đổi lịch", HttpStatus.CONFLICT);
        }
        MatchResponse current = view(matchId);
        if (hasStarted(current.getPlayDate(), current.getStartMinute())) {
            throw new AppException("Kèo đã đến giờ bắt đầu", HttpStatus.CONFLICT);
        }
        match.setReschedulePending(false);
        matchRepository.saveAndFlush(match);
        MatchResponse updated = getMatch(userId, matchId);
        matchNotifier.rescheduledMatchKept(updated, playerIds(matchId, JoinRequestStatus.APPROVED));
        return updated;
    }

    private Match lockMatchForHost(Long userId, Long matchId) {
        MatchResponse observed = view(matchId);
        if (!userId.equals(observed.getHostId())) {
            throw new AppException("Chỉ chủ kèo được thực hiện thao tác này", HttpStatus.FORBIDDEN);
        }
        // Same lock order as UC21 and UC22.
        bookingRepository.findByIdForUpdate(observed.getBookingId())
                .orElseThrow(() -> new AppException("Không tìm thấy booking", HttpStatus.NOT_FOUND));
        requireHost(userId, matchId);
        return matchRepository.findByIdForUpdate(matchId)
                .orElseThrow(() -> new AppException("Không tìm thấy kèo", HttpStatus.NOT_FOUND));
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
        // Khóa yêu cầu rồi khóa kèo trước khi đọc số chỗ: hai lần duyệt cùng lúc phải xếp hàng,
        // tránh mất cập nhật current/needed_players (Match không có cột version).
        MatchJoinRequest request = findPendingRequestForUpdate(requestId);
        requireHost(userId, request.getMatchId());
        Match match = matchRepository.findByIdForUpdate(request.getMatchId())
                .orElseThrow(() -> new AppException("Không tìm thấy kèo", HttpStatus.NOT_FOUND));
        if (match.getStatus() != MatchStatus.OPEN) {
            throw new AppException("Kèo không còn mở, không thể duyệt thêm người");
        }

        if (match.getNeededPlayers() < 1) {
            throw new AppException("Kèo đã đủ người, không thể duyệt thêm");
        }
        // D61: sau khi gửi yêu cầu, Player có thể đã vào kèo khác hoặc đặt booking trùng giờ — kiểm lại lúc duyệt.
        MatchResponse view = view(match.getId());
        JoinConflicts conflicts = matchQueryRepository.findJoinConflicts(request.getPlayerId(), match.getId(),
                view.getPlayDate(), view.getStartMinute(), view.getEndMinute());
        if (conflicts.approvedMatches() > 0 || conflicts.ownBookings() > 0) {
            throw new AppException(
                    "Người chơi này đã có kèo hoặc booking trùng giờ, không thể duyệt. Hãy từ chối yêu cầu",
                    HttpStatus.CONFLICT);
        }
        match.setCurrentPlayers(match.getCurrentPlayers() + 1);
        match.setNeededPlayers(match.getNeededPlayers() - 1);
        matchRepository.saveAndFlush(match);
        JoinRequestResponse approved = decide(request, JoinRequestStatus.APPROVED);
        matchNotifier.requestDecided(view(match.getId()), request.getPlayerId(), true);
        // UC28 N2 bước 4: người cuối cùng được duyệt thì kèo đủ người và tự đóng; chỉ báo người có yêu cầu bị hủy.
        if (match.getNeededPlayers() == 0) {
            endMatch(match, MatchStatus.CLOSED, false);
        }
        return approved;
    }

    @Transactional
    public JoinRequestResponse rejectJoinRequest(Long userId, Long requestId) {
        MatchJoinRequest request = findPendingRequest(requestId);
        requireHost(userId, request.getMatchId());
        JoinRequestResponse rejected = decide(request, JoinRequestStatus.REJECTED);
        matchNotifier.requestDecided(view(request.getMatchId()), request.getPlayerId(), false);
        return rejected;
    }

    // ---------------------------------------------------------------- UC29 – Xem thông tin kèo

    @Transactional(readOnly = true)
    public PageResponse<MatchResponse> getMatches(Long userId, String status, Long locationId, LocalDate playDate,
                                                  Integer fromMinute, Integer toMinute, int page, int size) {
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.min(Math.max(size, 1), 50);
        String statusFilter = StringUtils.hasText(status) ? parseMatchStatus(status).name() : MatchStatus.OPEN.name();
        boolean upcomingOnly = MatchStatus.OPEN.name().equals(statusFilter);
        validateMinuteRange(fromMinute, toMinute);
        MatchFilter filter = new MatchFilter(statusFilter, locationId, playDate, fromMinute, toMinute, upcomingOnly);

        List<MatchResponse> content = matchQueryRepository
                .searchMatches(filter, pageNumber * pageSize, pageSize)
                .stream().map(m -> enrich(m, userId)).toList();
        return toPage(content, matchQueryRepository.countMatches(filter), pageNumber, pageSize);
    }

    /**
     * UC28, UC29 – "Kèo của tôi": kèo mình làm chủ và kèo mình đã xin vào (còn chờ hoặc đã được duyệt).
     * role: HOSTED, JOINED hoặc bỏ trống để lấy cả hai; status bỏ trống để lấy mọi trạng thái.
     */
    @Transactional(readOnly = true)
    public PageResponse<MatchResponse> getMyMatches(Long userId, String role, String status, int page, int size) {
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.min(Math.max(size, 1), 50);
        String roleFilter = parseMyMatchRole(role);
        String statusFilter = StringUtils.hasText(status) ? parseMatchStatus(status).name() : null;

        List<MatchResponse> content = matchQueryRepository
                .findMyMatches(userId, roleFilter, statusFilter, pageNumber * pageSize, pageSize)
                .stream().map(m -> enrich(m, userId)).toList();
        return toPage(content, matchQueryRepository.countMyMatches(userId, roleFilter, statusFilter),
                pageNumber, pageSize);
    }

    private static String parseMyMatchRole(String role) {
        if (!StringUtils.hasText(role)) {
            return null;
        }
        String value = role.trim().toUpperCase();
        if (!value.equals("HOSTED") && !value.equals("JOINED")) {
            throw new AppException("Vai trò lọc kèo không hợp lệ, chọn HOSTED hoặc JOINED");
        }
        return value;
    }

    private static PageResponse<MatchResponse> toPage(List<MatchResponse> content, long total, int pageNumber,
            int pageSize) {
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
        // D61: không tham gia hai kèo trùng giờ, không xin kèo trùng giờ với booking của mình.
        // D62: mỗi khung giờ chỉ một yêu cầu đang chờ; muốn xin kèo khác phải rút yêu cầu cũ.
        JoinConflicts conflicts = matchQueryRepository.findJoinConflicts(userId, matchId,
                view.getPlayDate(), view.getStartMinute(), view.getEndMinute());
        if (conflicts.approvedMatches() > 0) {
            throw new AppException("Bạn đã tham gia một kèo khác trùng giờ với kèo này", HttpStatus.CONFLICT);
        }
        if (conflicts.ownBookings() > 0) {
            throw new AppException("Bạn đã có booking trùng giờ với kèo này", HttpStatus.CONFLICT);
        }
        if (conflicts.pendingRequests() > 0) {
            throw new AppException(
                    "Bạn đang chờ duyệt một kèo khác trùng giờ. Hãy rút yêu cầu đó trước khi xin vào kèo này",
                    HttpStatus.CONFLICT);
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

    // ---------------------------------------------------------------- Job định kỳ

    /**
     * UC37 bước 8, JOB10, FR101: kèo của booking bị hủy thì hết hạn; kèo còn tuyển khi tới giờ chơi thì tự đóng;
     * sau đó hủy các yêu cầu tham gia còn chờ của những kèo đã kết thúc (FR102).
     * Booking đổi lịch không làm kèo thay đổi: chủ kèo tự quyết giữ hay hủy (FR90).
     */
    @Transactional
    public int sweepEndedMatches() {
        // Xét booking bị hủy trước: kèo của booking bị hủy là hết hạn, kể cả khi đã tới giờ chơi.
        List<Long> expired = matchQueryRepository.findActiveMatchIdsOfCancelledBookings();
        expired.forEach(id -> endMatch(findMatch(id), MatchStatus.EXPIRED, true));
        List<Long> closed = matchQueryRepository.findStartedOpenMatchIds();
        closed.forEach(id -> endMatch(findMatch(id), MatchStatus.CLOSED, false));
        return expired.size() + closed.size();
    }

    /**
     * FR90, UC28 A4 – gọi sau khi booking có kèo được đổi sang slot mới (đổi lịch UC21,
     * hoặc chuyển slot miễn phí khi bị ảnh hưởng UC22). Kèo giữ nguyên trạng thái và tự hiển thị giờ mới;
     * chủ kèo được nhắc quyết định giữ hay hủy, người chơi liên quan nhận MSG76.
     */
    @Transactional
    public void onBookingRescheduled(Long bookingId) {
        matchRepository.findFirstByBookingIdAndStatusIn(bookingId, Set.of(MatchStatus.OPEN, MatchStatus.CLOSED))
                .ifPresent(match -> {
                    // Chủ kèo phải chọn giữ kèo theo giờ mới hay hủy kèo (FR90).
                    match.setReschedulePending(true);
                    matchRepository.saveAndFlush(match);
                    matchQueryRepository.findMatch(match.getId())
                            .ifPresent(view -> matchNotifier.matchRescheduled(view,
                                    playerIds(match.getId(), JoinRequestStatus.APPROVED),
                                    playerIds(match.getId(), JoinRequestStatus.PENDING)));
                });
    }

    /**
     * UC22, FR101 – gọi ngay khi booking có kèo bị hủy (Player hủy, cơ sở hủy), trong cùng transaction hủy booking.
     * Kèo còn hiệu lực chuyển EXPIRED, yêu cầu còn chờ bị hủy (FR102), thành viên và người chờ nhận MSG76.
     * Job sweepEndedMatches vẫn là lưới an toàn cho booking bị hủy ở luồng khác.
     */
    @Transactional
    public void onBookingCancelled(Long bookingId) {
        matchRepository.findByBookingIdAndStatusInForUpdate(bookingId, Set.of(MatchStatus.OPEN, MatchStatus.CLOSED))
                .forEach(match -> endMatch(match, MatchStatus.EXPIRED, true));
    }

    // ---------------------------------------------------------------- Helper

    /**
     * Chuyển kèo sang trạng thái kết thúc, hủy các yêu cầu còn chờ (FR102) và gửi MSG76.
     * notifyApproved: báo cả thành viên đã duyệt (chủ kèo đóng/hủy, booking bị hủy), không báo khi kèo tự đóng.
     */
    private void endMatch(Match match, MatchStatus status, boolean notifyApproved) {
        match.setStatus(status);
        if (status != MatchStatus.CLOSED) match.setReschedulePending(false);
        match.setClosedAt(LocalDateTime.now());
        matchRepository.saveAndFlush(match);

        List<MatchJoinRequest> pending = matchJoinRequestRepository.findByMatchIdAndStatus(match.getId(),
                JoinRequestStatus.PENDING);
        pending.forEach(r -> {
            r.setStatus(JoinRequestStatus.CANCELLED);
            r.setDecidedAt(LocalDateTime.now());
        });
        matchJoinRequestRepository.saveAllAndFlush(pending);

        List<Long> approved = notifyApproved ? playerIds(match.getId(), JoinRequestStatus.APPROVED) : List.of();
        // Không lấy được thông tin hiển thị thì bỏ qua thông báo, không làm hỏng giao dịch hủy booking/đóng kèo.
        matchQueryRepository.findMatch(match.getId()).ifPresent(view -> matchNotifier.matchEnded(view, status, approved,
                pending.stream().map(MatchJoinRequest::getPlayerId).toList()));
    }

    private List<Long> playerIds(Long matchId, JoinRequestStatus status) {
        return matchJoinRequestRepository.findByMatchIdAndStatus(matchId, status).stream()
                .map(MatchJoinRequest::getPlayerId).toList();
    }

    /** Khung giờ lọc tính theo phút trong ngày: 0 ≤ fromMinute < toMinute ≤ 1440. */
    private static void validateMinuteRange(Integer fromMinute, Integer toMinute) {
        if ((fromMinute != null && (fromMinute < 0 || fromMinute >= 1440))
                || (toMinute != null && (toMinute <= 0 || toMinute > 1440))) {
            throw new AppException("Khung giờ lọc phải nằm trong ngày (0–1440 phút)");
        }
        if (fromMinute != null && toMinute != null && fromMinute >= toMinute) {
            throw new AppException("Giờ bắt đầu lọc phải trước giờ kết thúc lọc");
        }
    }

    private MatchResponse view(Long matchId) {
        return matchQueryRepository.findMatch(matchId)
                .orElseThrow(() -> new AppException("Không tìm thấy kèo", HttpStatus.NOT_FOUND));
    }

    private MatchResponse enrich(MatchResponse match, Long userId) {
        boolean isHost = match.getHostId().equals(userId);
        MatchJoinRequest myRequest = userId == null ? null : matchJoinRequestRepository
                .findFirstByMatchIdAndPlayerIdOrderByCreatedAtDesc(match.getId(), userId)
                .orElse(null);
        String myJoinStatus = myRequest == null ? null : myRequest.getStatus().name();

        match.setHost(isHost);
        match.setMyJoinStatus(myJoinStatus);
        match.setMyJoinRequestId(myRequest == null ? null : myRequest.getId());
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
        return requirePending(matchJoinRequestRepository.findById(requestId));
    }

    /** Khóa dòng yêu cầu để hai lần duyệt cùng một yêu cầu không chạy song song. */
    private MatchJoinRequest findPendingRequestForUpdate(Long requestId) {
        return requirePending(matchJoinRequestRepository.findByIdForUpdate(requestId));
    }

    private MatchJoinRequest requirePending(java.util.Optional<MatchJoinRequest> found) {
        MatchJoinRequest request = found
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
