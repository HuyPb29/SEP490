package com.sep490.bms.dto.team;

import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Trả thông tin kèo, lịch chơi, chủ kèo, số người và trạng thái tham gia của người xem.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchResponse {

    private Long id;
    private Long bookingId;
    private String bookingCode;
    private Long teamId;
    private String teamName;
    private Long hostId;
    private String hostName;
    /** Chỉ hiện với chủ kèo hoặc người đã được duyệt vào kèo. */
    private String hostPhone;
    private Long locationId;
    private String locationName;
    private String courtName;
    private LocalDate playDate;
    private int startMinute;
    private int endMinute;
    private int currentPlayers;
    private int neededPlayers;
    private String status;
    /** Trạng thái yêu cầu tham gia gần nhất của người đang xem, null nếu chưa gửi. */
    private String myJoinStatus;
    private boolean host;
    private boolean reschedulePending;
    private LocalDateTime createdAt;
    private LocalDateTime closedAt;
}
