package com.sep490.bms.dto.feedback;

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
public class ComplaintResponse {

    private Long id;
    private Long locationId;
    private String locationName;
    private Long bookingId;
    private String bookingCode;
    private Long paymentId;
    private Long playerId;
    private String playerName;
    private Long createdBy;
    private String complaintType;
    private String content;
    private String status;
    private String staffNote;
    private Long handledBy;
    private String result;
    private String rejectReason;
    private Integer compensationPoints;
    private Long decidedBy;
    private LocalDateTime decidedAt;
    private LocalDateTime createdAt;
}
