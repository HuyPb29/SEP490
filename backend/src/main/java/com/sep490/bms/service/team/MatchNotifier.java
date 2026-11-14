package com.sep490.bms.service.team;

import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.LinkedHashSet;

import org.springframework.stereotype.Component;

import com.sep490.bms.dto.team.MatchResponse;
import com.sep490.bms.entity.notification.Notification;
import com.sep490.bms.entity.team.MatchStatus;
import com.sep490.bms.repository.notification.NotificationRepository;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F7 – Đội và kèo
 * Owner: Hoàng
 * Thông báo trong ứng dụng cho kèo (FR124): kết quả yêu cầu tham gia (MSG75),
 * kèo đổi giờ, đóng, bị hủy hoặc hết hạn (MSG76, FR100, FR102, FR90).
 */
@Component
@RequiredArgsConstructor
public class MatchNotifier {

    private static final String REF_TYPE = "MATCH";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final NotificationRepository notificationRepository;

    /** MSG75 – chủ kèo duyệt hoặc từ chối yêu cầu. */
    public void requestDecided(MatchResponse match, Long playerId, boolean approved) {
        if (approved) {
            send(playerId, "MATCH_REQUEST_APPROVED", "Yêu cầu tham gia kèo đã được duyệt",
                    describe(match) + ". Bạn có thể xem số điện thoại chủ kèo trong chi tiết kèo.", match.getId());
        } else {
            send(playerId, "MATCH_REQUEST_REJECTED", "Yêu cầu tham gia kèo bị từ chối",
                    describe(match) + ".", match.getId());
        }
    }

    /**
     * MSG76 – kèo kết thúc. Người có yêu cầu còn chờ bị hủy luôn được báo (FR102);
     * thành viên đã duyệt được báo khi kèo bị hủy hoặc hết hạn, hoặc khi chủ kèo chủ động đóng (FR100).
     */
    public void matchEnded(MatchResponse match, MatchStatus status, Collection<Long> approvedPlayerIds,
            Collection<Long> cancelledRequestPlayerIds) {
        String outcome = switch (status) {
            case CLOSED -> "đã đóng";
            case CANCELLED -> "đã bị chủ kèo hủy";
            case EXPIRED -> "đã hết hạn do booking bị hủy";
            default -> "đã kết thúc";
        };
        for (Long playerId : approvedPlayerIds) {
            send(playerId, "MATCH_" + status.name(), "Kèo bạn tham gia " + outcome,
                    describe(match) + " " + outcome + ".", match.getId());
        }
        for (Long playerId : cancelledRequestPlayerIds) {
            send(playerId, "MATCH_REQUEST_CANCELLED", "Yêu cầu tham gia kèo đã bị hủy",
                    describe(match) + " " + outcome + " nên yêu cầu của bạn được hủy tự động.", match.getId());
        }
    }

    /**
     * MSG76, FR90 – booking của kèo đổi lịch: báo người chơi liên quan giờ mới
     * và nhắc chủ kèo quyết định giữ hay hủy kèo.
     */
    public void matchRescheduled(MatchResponse match, Collection<Long> approvedPlayerIds,
            Collection<Long> pendingRequestPlayerIds) {
        send(match.getHostId(), "MATCH_RESCHEDULED_HOST", "Booking có kèo đã đổi lịch",
                describe(match) + ". Vào Kèo của tôi để giữ kèo ở giờ mới hoặc hủy kèo.", match.getId());
        LinkedHashSet<Long> players = new LinkedHashSet<>(approvedPlayerIds);
        players.addAll(pendingRequestPlayerIds);
        for (Long playerId : players) {
            send(playerId, "MATCH_RESCHEDULED", "Kèo đã đổi sang giờ mới",
                    describe(match) + ". Chủ kèo sẽ quyết định giữ hay hủy kèo.", match.getId());
        }
    }

    public void rescheduledMatchKept(MatchResponse match, Collection<Long> approvedPlayerIds) {
        for (Long playerId : approvedPlayerIds) {
            send(playerId, "MATCH_RESCHEDULED_KEPT", "Chủ kèo giữ kèo theo giờ mới", describe(match) + ".", match.getId());
        }
    }

    private void send(Long recipientId, String type, String title, String content, Long matchId) {
        notificationRepository.save(Notification.builder()
                .recipientId(recipientId)
                .type(type)
                .title(title)
                .content(content.length() <= 500 ? content : content.substring(0, 500))
                .refType(REF_TYPE)
                .refId(matchId)
                .build());
    }

    /** Ví dụ: "Kèo tại Sân 1 – Smash Arena, 10/10/2026 18:00–19:30". */
    private static String describe(MatchResponse m) {
        return "Kèo tại " + m.getCourtName() + " – " + m.getLocationName() + ", " + m.getPlayDate().format(DATE)
                + " " + minute(m.getStartMinute()) + "–" + minute(m.getEndMinute());
    }

    private static String minute(int minute) {
        return String.format("%02d:%02d", (minute / 60) % 24, minute % 60);
    }
}
