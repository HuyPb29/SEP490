package com.sep490.bms.dto.booking;

import java.time.LocalDate;
import java.util.List;

import com.sep490.bms.entity.enums.PackageType;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Lịch toàn kỳ của gói đặt nhiều buổi (UC15 #4, #5, #10, FR41, FR42, FR45). Không lưu gì, không giữ chỗ (BR53).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackagePreviewResponse {

    private Long locationId;
    private String locationName;
    private PackageType packageType;
    /** Ngày của buổi đầu và buổi cuối. */
    private LocalDate startDate;
    private LocalDate endDate;
    private int totalSessions;
    /** Các buổi theo ngày giờ chơi. */
    private List<Session> sessions;

    /** Một buổi con của gói. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Session {
        private LocalDate date;
        private Long courtId;
        private String courtName;
        private int startMinute;
        private int endMinute;
        /** Giờ dạng HH:mm, 24 giờ là "24:00". */
        private String startTime;
        private String endTime;
    }
}
