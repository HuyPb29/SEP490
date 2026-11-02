package com.sep490.bms.dto.operation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

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
public class StaffDashboardResponse {

    private Long locationId;
    private String locationName;
    private LocalDate date;

    /** Số booking hôm nay theo trạng thái. */
    private Map<String, Long> bookingsByStatus;
    private List<BookingItem> todayBookings;

    private long paymentsAwaitingConfirmation;
    private long complaintsToForward;
    private BigDecimal todayRevenue;
    private boolean reconciledToday;

    @Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
    public static class BookingItem {
        private Long id;
        private String bookingCode;
        private String courtName;
        private int startMinute;
        private int endMinute;
        private String customerName;
        private String customerPhone;
        private String status;
        private BigDecimal finalAmount;
    }
}
