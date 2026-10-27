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
public class ReviewResponse {

    private Long id;
    private Long bookingId;
    private Long locationId;
    private String locationName;
    private Long playerId;
    private String playerName;
    private int rating;
    private String comment;
    private String ownerReply;
    private boolean hidden;
    private LocalDateTime createdAt;
}
