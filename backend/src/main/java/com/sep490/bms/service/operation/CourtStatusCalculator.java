package com.sep490.bms.service.operation;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import com.sep490.bms.dto.operation.StaffDashboardResponse.CourtItem;
import com.sep490.bms.repository.operation.OperationQueryRepository.CourtBookingRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.CourtRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.MaintenanceRow;

/**
 * Feature: F9 – Vận hành và báo cáo
 * Owner: Hoàng
 * UC34 – trạng thái từng sân tại một thời điểm: bảo trì được ưu tiên, sau đó booking đang chiếm sân,
 * còn lại là trống kèm booking kế tiếp trong ngày.
 */
final class CourtStatusCalculator {

    static final String AVAILABLE = "AVAILABLE";
    static final String IN_USE = "IN_USE";
    static final String HOLDING = "HOLDING";
    static final String MAINTENANCE = "MAINTENANCE";

    /** Booking đã chốt thanh toán: sân đang được chơi. Các trạng thái giữ sân còn lại là chờ thanh toán. */
    private static final Set<String> PAID = Set.of("CONFIRMED", "IN_USE", "COMPLETED");

    private CourtStatusCalculator() {
    }

    /** bookings: booking giữ sân của chính ngày now; maintenance: bảo trì đã duyệt đang diễn ra lúc now. */
    static List<CourtItem> calculate(List<CourtRow> courts, List<CourtBookingRow> bookings,
            List<MaintenanceRow> maintenance, LocalDateTime now) {
        int nowMinute = now.getHour() * 60 + now.getMinute();
        Map<Long, List<CourtBookingRow>> byCourt = bookings.stream()
                .collect(Collectors.groupingBy(CourtBookingRow::getCourtId));
        Map<Long, LocalDateTime> maintenanceEnd = maintenance.stream()
                .collect(Collectors.toMap(MaintenanceRow::getCourtId, MaintenanceRow::getEndAt,
                        (a, b) -> a.isAfter(b) ? a : b));

        return courts.stream().map(court -> {
            List<CourtBookingRow> rows = byCourt.getOrDefault(court.getId(), List.of());
            Optional<CourtBookingRow> next = rows.stream()
                    .filter(r -> r.getStartMinute() > nowMinute)
                    .min(Comparator.comparingInt(CourtBookingRow::getStartMinute));
            CourtItem.CourtItemBuilder item = CourtItem.builder()
                    .courtId(court.getId())
                    .courtName(court.getName())
                    .nextBookingCode(next.map(CourtBookingRow::getBookingCode).orElse(null))
                    .nextStartMinute(next.map(CourtBookingRow::getStartMinute).orElse(null));

            LocalDateTime maintenanceUntil = maintenanceEnd.get(court.getId());
            if (maintenanceUntil != null) {
                return item.status(MAINTENANCE).maintenanceUntil(maintenanceUntil).build();
            }
            Optional<CourtBookingRow> current = rows.stream()
                    .filter(r -> r.getStartMinute() <= nowMinute && nowMinute < r.getEndMinute())
                    .findFirst();
            if (current.isPresent()) {
                CourtBookingRow row = current.get();
                return item.status(PAID.contains(row.getStatus()) ? IN_USE : HOLDING)
                        .bookingCode(row.getBookingCode())
                        .untilMinute(row.getEndMinute())
                        .build();
            }
            return item.status(AVAILABLE).build();
        }).toList();
    }
}
