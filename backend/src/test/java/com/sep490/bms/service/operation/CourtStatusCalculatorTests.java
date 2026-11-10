package com.sep490.bms.service.operation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.sep490.bms.dto.operation.StaffDashboardResponse.CourtItem;
import com.sep490.bms.repository.operation.OperationQueryRepository.CourtBookingRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.CourtRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.MaintenanceRow;

/** F9 UC34 – trạng thái sân trên bảng điều hành Staff, tính tại 18:50. */
class CourtStatusCalculatorTests {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 24, 18, 50);
    private static final List<CourtRow> COURTS = List.of(new CourtRow(1L, "S1"), new CourtRow(2L, "S2"),
            new CourtRow(3L, "S3"), new CourtRow(4L, "S4"));

    @Test
    void classifiesEachCourtAtTheCurrentMinute() {
        List<CourtBookingRow> bookings = List.of(
                new CourtBookingRow(1L, "BK-1", 1080, 1200, "CONFIRMED"),    // 18:00–20:00 đang chơi
                new CourtBookingRow(2L, "BK-2", 1110, 1140, "HOLDING"),      // 18:30–19:00 chờ thanh toán
                new CourtBookingRow(3L, "BK-3", 1020, 1080, "COMPLETED"),    // 17:00–18:00 đã xong
                new CourtBookingRow(3L, "BK-4", 1140, 1200, "CONFIRMED"),    // 19:00 kế tiếp
                new CourtBookingRow(3L, "BK-5", 1260, 1320, "CONFIRMED"));
        List<MaintenanceRow> maintenance = List.of(new MaintenanceRow(4L, NOW.plusDays(1).withHour(8)));

        List<CourtItem> courts = CourtStatusCalculator.calculate(COURTS, bookings, maintenance, NOW);

        assertThat(courts).extracting(CourtItem::getStatus)
                .containsExactly("IN_USE", "HOLDING", "AVAILABLE", "MAINTENANCE");
        assertThat(courts.get(0).getBookingCode()).isEqualTo("BK-1");
        assertThat(courts.get(0).getUntilMinute()).isEqualTo(1200);
        assertThat(courts.get(1).getUntilMinute()).isEqualTo(1140);
        assertThat(courts.get(2).getNextBookingCode()).isEqualTo("BK-4");
        assertThat(courts.get(2).getNextStartMinute()).isEqualTo(1140);
        assertThat(courts.get(3).getMaintenanceUntil()).isEqualTo(NOW.plusDays(1).withHour(8));
    }

    @Test
    void maintenanceWinsOverBookingAndBookingEndingNowFreesTheCourt() {
        List<CourtBookingRow> bookings = List.of(
                new CourtBookingRow(1L, "BK-1", 1080, 1130, "CONFIRMED"),    // kết thúc đúng 18:50
                new CourtBookingRow(4L, "BK-4", 1080, 1200, "CONFIRMED"));
        List<MaintenanceRow> maintenance = List.of(new MaintenanceRow(4L, NOW.withHour(20).withMinute(0)));

        List<CourtItem> courts = CourtStatusCalculator.calculate(COURTS, bookings, maintenance, NOW);

        assertThat(courts.get(0).getStatus()).isEqualTo("AVAILABLE");
        assertThat(courts.get(0).getNextBookingCode()).isNull();
        assertThat(courts.get(3).getStatus()).isEqualTo("MAINTENANCE");
        assertThat(courts.get(3).getBookingCode()).isNull();
    }
}
