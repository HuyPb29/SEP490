package com.sep490.bms.dto.booking;

import java.time.LocalDateTime;

/** Điều kiện đổi lịch và yêu cầu phụ thu đang mở của booking. */
public record RescheduleEligibility(boolean canReschedule, LocalDateTime deadline, Long pendingRequestId) {}
