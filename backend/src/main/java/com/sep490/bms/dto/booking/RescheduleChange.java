package com.sep490.bms.dto.booking;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Một lần đổi lịch đã thành công của booking (UC21): đổi từ slot nào sang slot nào.
 * from* để trống khi không còn dòng slot gốc để dựng lại (dữ liệu cũ trước khi có booking_slot).
 * Giờ dạng HH:mm.
 */
public record RescheduleChange(Long bookingId, String bookingCode,
        String fromCourtName, LocalDate fromDate, String fromStartTime, String fromEndTime,
        String toCourtName, LocalDate toDate, String toStartTime, String toEndTime,
        LocalDateTime changedAt) {}
