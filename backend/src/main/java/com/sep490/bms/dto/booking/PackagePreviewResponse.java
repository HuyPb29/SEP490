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
    /** Số buổi bị trùng: đã có người giữ/đặt, bảo trì, ngoài giờ mở cửa hoặc đã bắt đầu (BR50). */
    private int conflictSessions;
    /** Dòng tóm tắt lịch của gói (MSG43). */
    private String summary;
    /** Lịch theo từng tháng: tổng số buổi và số buổi bị trùng của mỗi tháng (FR45). */
    private List<MonthSummary> months;
    /** Các buổi theo ngày giờ chơi. */
    private List<Session> sessions;

    /** Vì sao một buổi không đặt được. */
    public enum Conflict {
        /** Đã có người giữ chỗ hoặc đặt (kể cả chính Player đang giữ). */
        TAKEN,
        /** Trùng lịch bảo trì đã duyệt. */
        MAINTENANCE,
        /** Ngoài giờ mở cửa của ngày đó. */
        CLOSED,
        /** Buổi hôm nay đã đến giờ bắt đầu. */
        STARTED
    }

    /** Tóm tắt một tháng của lịch gói, ví dụ month = "2026-12". */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MonthSummary {
        private String month;
        private int totalSessions;
        private int conflictSessions;
    }

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
        /** Trống là buổi đặt được; có giá trị thì Player chọn slot bù hoặc bỏ buổi này (BR50). */
        private Conflict conflict;
    }
}
