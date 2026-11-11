package com.sep490.bms.dto.team;

import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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
    /** Trình độ tự khai của chủ kèo, FE hiển thị làm nhãn trình độ của kèo (UC29). */
    private String hostSkillLevel;
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
    /** Id yêu cầu tham gia gần nhất của người đang xem, dùng để rút yêu cầu (UC30); null nếu chưa gửi. */
    private Long myJoinRequestId;
    private boolean host;
    private LocalDateTime createdAt;
    private LocalDateTime closedAt;
}
