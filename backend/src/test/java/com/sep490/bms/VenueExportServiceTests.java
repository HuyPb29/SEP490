package com.sep490.bms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.sep490.bms.entity.AccountStatus;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.operation.OperationQueryRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.operation.VenueExportService;

/** F9 – UC36: file Excel ba sheet (FR122); chạy trong transaction rollback. */
@SpringBootTest(properties = "bms.scheduler.match-sweep.enabled=false")
@Transactional
class VenueExportServiceTests {

    @Autowired JdbcTemplate jdbc;
    @Autowired LocationRepository locations;
    @Autowired VenueExportService exports;
    @Autowired OperationQueryRepository reports;

    Long ownerId;
    Long playerId;
    Long locationId;
    Long courtId;
    LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() {
        ownerId = account("OWNER");
        playerId = account("PLAYER");
        locationId = locations.saveAndFlush(Location.builder().ownerId(ownerId).name("Export test")
                .address("Test").contactPhone("0987654321").latitude(BigDecimal.ONE).longitude(BigDecimal.ONE)
                .build()).getId();
        jdbc.update("INSERT INTO court (location_id, name, is_active) VALUES (?, 'S1', 1)", locationId);
        courtId = jdbc.queryForObject("SELECT MAX(id) FROM court WHERE location_id = ?", Long.class, locationId);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Location-Id", locationId);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void workbookHasThreeSheetsWithHeaderOnlyWhenNoData() throws Exception {
        try (Workbook wb = open(exports.exportVenueData(owner(), today.minusDays(7), today))) {
            assertThat(List.of(wb.getSheetName(0), wb.getSheetName(1), wb.getSheetName(2)))
                    .containsExactly("Lịch sắp tới", "Booking đã qua", "Thu chi");
            for (int i = 0; i < 3; i++) {
                Sheet sheet = wb.getSheetAt(i);
                assertThat(sheet.getLastRowNum()).as(sheet.getSheetName()).isZero();
                assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isNotBlank();
            }
        }
    }

    @Test
    void upcomingSheetListsOnlyConfirmedFutureBookings() throws Exception {
        String confirmed = booking("CONFIRMED", today.plusDays(2), 120000);
        booking("CANCELLED_BY_PLAYER", today.plusDays(3), 90000);
        booking("CONFIRMED", today.minusDays(2), 80000);

        try (Workbook wb = open(exports.exportVenueData(owner(), today.minusDays(7), today))) {
            Sheet upcoming = wb.getSheet("Lịch sắp tới");
            assertThat(upcoming.getLastRowNum()).isEqualTo(1);
            assertThat(upcoming.getRow(1).getCell(4).getStringCellValue()).isEqualTo(confirmed);
            assertThat(upcoming.getRow(1).getCell(8).getNumericCellValue()).isEqualTo(120000);
        }
    }

    @Test
    void pastSheetListsEndedBookingsInPeriodAndCashSheetTotalsAmountDue() throws Exception {
        String past = booking("COMPLETED", today.minusDays(2), 80000);
        booking("COMPLETED", today.minusDays(30), 70000);
        payment(past, 80000, 100000, today.minusDays(2).atTime(9, 0));

        try (Workbook wb = open(exports.exportVenueData(owner(), today.minusDays(7), today))) {
            Sheet pastSheet = wb.getSheet("Booking đã qua");
            assertThat(pastSheet.getLastRowNum()).isEqualTo(1);
            assertThat(pastSheet.getRow(1).getCell(4).getStringCellValue()).isEqualTo(past);

            Sheet cash = wb.getSheet("Thu chi");
            assertThat(cash.getRow(1).getCell(1).getStringCellValue()).isEqualTo("Thu");
            assertThat(cash.getRow(1).getCell(3).getStringCellValue()).isEqualTo(past);
            // BR37, BR51: doanh thu theo số tiền phải trả, không tính tiền chuyển thừa.
            assertThat(cash.getRow(1).getCell(6).getNumericCellValue()).isEqualTo(80000);
            assertThat(cash.getRow(3).getCell(6).getNumericCellValue()).isEqualTo(80000);
        }
    }

    @Test
    void refundReportsAndExportRequireConfirmedBookingOrPackagePayment() throws Exception {
        LocalDate created = today.minusDays(2);
        String paid = booking("CANCELLED_BY_FACILITY", today.minusDays(1), 80000);
        String paidSession = booking("CANCELLED_BY_FACILITY", today.minusDays(1), 60000);
        String awaiting = booking("CANCELLED_BY_FACILITY", today.minusDays(1), 50000);
        String unpaid = booking("CANCELLED_BY_FACILITY", today.minusDays(1), 40000);
        payment(paid, 80000, 80000, created.atTime(9, 0));
        confirmPackagePayment(paidSession, created);
        jdbc.update("""
                INSERT INTO payment (location_id, booking_id, amount_due, status)
                SELECT location_id, id, final_amount, 'AWAITING_CONFIRMATION' FROM booking WHERE booking_code = ?
                """, awaiting);
        recordedRefund(paid, 10000, created);
        recordedRefund(paidSession, 20000, created);
        recordedRefund(awaiting, 30000, created);
        recordedRefund(unpaid, 40000, created);

        assertThat(reports.sumRefunds(locationId, today, today)).singleElement().satisfies(row -> {
            assertThat(row.getCount()).isEqualTo(2);
            assertThat(row.getAmount()).isEqualByComparingTo("30000");
        });
        assertThat(reports.sumRefunds(locationId, created, created)).isEmpty();
        var refundRequests = reports.sumRefundRequests(locationId, created, created);
        assertThat(refundRequests.getCount()).isEqualTo(2);
        assertThat(refundRequests.getAmount()).isEqualByComparingTo("30000");
        assertThat(reports.sumRefundRequests(locationId, today, today).getCount()).isZero();

        try (Workbook wb = open(exports.exportVenueData(owner(), today, today))) {
            Sheet cash = wb.getSheet("Thu chi");
            assertThat(cash.getRow(1).getCell(1).getStringCellValue()).isEqualTo("Chi");
            assertThat(cash.getRow(1).getCell(3).getStringCellValue()).isEqualTo(paid);
            assertThat(cash.getRow(2).getCell(1).getStringCellValue()).isEqualTo("Chi");
            assertThat(cash.getRow(2).getCell(3).getStringCellValue()).isEqualTo(paidSession);
            assertThat(cash.getRow(4).getCell(7).getNumericCellValue()).isEqualTo(30000);
        }
    }

    @Test
    void rejectsPeriodWhereFromIsAfterTo() {
        assertThatThrownBy(() -> exports.exportVenueData(owner(), today, today.minusDays(1)))
                .isInstanceOf(AppException.class);
    }

    // ---------------------------------------------------------------- fixtures

    private Workbook open(byte[] bytes) throws Exception {
        return new XSSFWorkbook(new ByteArrayInputStream(bytes));
    }

    private UserPrincipal owner() {
        return UserPrincipal.builder().id(ownerId).username("u" + ownerId).role(Role.OWNER)
                .status(AccountStatus.ACTIVE).authorities(List.of()).build();
    }

    /** Tạo account bằng SQL để không phụ thuộc cột chỉ có trong migration cục bộ. */
    private Long account(String role) {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String phone = "0" + String.format("%09d", Math.floorMod((long) id.hashCode(), 1000000000L));
        jdbc.update("""
                INSERT INTO account (username, email, phone, full_name, password_hash, role, status)
                VALUES (?, ?, ?, 'Export Test', 'test-unused', ?, 'ACTIVE')
                """, "e" + id, id + "@example.com", phone, role);
        return jdbc.queryForObject("SELECT id FROM account WHERE username = ?", Long.class, "e" + id);
    }

    private String booking(String status, LocalDate playDate, long amount) {
        String code = "X" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        jdbc.update("""
                INSERT INTO booking (booking_code, booking_type, location_id, court_id, player_id, play_date,
                    start_minute, end_minute, list_amount, final_amount, status)
                VALUES (?, 'SINGLE', ?, ?, ?, ?, 480, 540, ?, ?, ?)
                """, code, locationId, courtId, playerId, java.sql.Date.valueOf(playDate), amount, amount, status);
        return code;
    }

    private void payment(String bookingCode, long due, long received, LocalDateTime confirmedAt) {
        Long bookingId = jdbc.queryForObject("SELECT id FROM booking WHERE booking_code = ?", Long.class, bookingCode);
        jdbc.update("""
                INSERT INTO payment (location_id, booking_id, amount_due, received_amount, status, confirmed_at)
                VALUES (?, ?, ?, ?, 'CONFIRMED', ?)
                """, locationId, bookingId, due, received, java.sql.Timestamp.valueOf(confirmedAt));
    }

    private void confirmPackagePayment(String bookingCode, LocalDate confirmedDate) {
        Long packageId = jdbc.queryForObject("""
                INSERT INTO booking_package (location_id, player_id, package_type, start_date, end_date,
                    list_amount, final_amount, status)
                OUTPUT INSERTED.id
                VALUES (?, ?, 'CUSTOM', ?, ?, 60000, 60000, 'CONFIRMED')
                """, Long.class, locationId, playerId, Date.valueOf(today.minusDays(1)), Date.valueOf(today));
        jdbc.update("UPDATE booking SET booking_type = 'SESSION', package_id = ? WHERE booking_code = ?",
                packageId, bookingCode);
        jdbc.update("""
                INSERT INTO payment (location_id, package_id, amount_due, received_amount, status, confirmed_at)
                VALUES (?, ?, 60000, 60000, 'CONFIRMED', ?)
                """, locationId, packageId, java.sql.Timestamp.valueOf(confirmedDate.atTime(9, 0)));
    }

    private void recordedRefund(String bookingCode, long amount, LocalDate created) {
        Long complaintId = jdbc.queryForObject("""
                INSERT INTO complaint (location_id, booking_id, player_id, created_by, complaint_type, content)
                OUTPUT INSERTED.id
                SELECT location_id, id, player_id, player_id, 'OTHER', 'Refund report fixture'
                FROM booking WHERE booking_code = ?
                """, Long.class, bookingCode);
        jdbc.update("""
                INSERT INTO refund_request (location_id, booking_id, complaint_id, suggested_amount, refunded_amount,
                    original_payment_date, refund_date, created_at, status)
                SELECT location_id, id, ?, ?, ?, ?, ?, ?, 'REFUNDED'
                FROM booking WHERE booking_code = ?
                """, complaintId, amount, amount, Date.valueOf(created), Date.valueOf(today),
                java.sql.Timestamp.valueOf(created.atTime(10, 0)), bookingCode);
    }
}
