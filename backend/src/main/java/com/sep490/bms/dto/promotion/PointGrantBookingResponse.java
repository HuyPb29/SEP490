package com.sep490.bms.dto.promotion;

import java.time.LocalDate;

/** Lịch đặt thuộc Player và địa điểm được chọn trong Point Grant. */
public record PointGrantBookingResponse(Long id, String bookingCode, LocalDate playDate, int startMinute, int endMinute) {}
