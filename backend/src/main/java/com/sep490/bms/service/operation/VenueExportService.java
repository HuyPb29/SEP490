package com.sep490.bms.service.operation;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.entity.Location;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.operation.OperationQueryRepository;
import com.sep490.bms.repository.operation.OperationQueryRepository.BookingDetailRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.IncomeRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.RefundRow;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * F9 – UC36 Tải dữ liệu địa điểm (FR122): một file Excel ba sheet cho địa điểm đang chọn.
 * (1) Lịch sắp tới: mọi booking đã xác nhận từ ngày tải trở đi;
 * (2) Booking đã qua và (3) Thu chi: trong kỳ Owner chọn. Kỳ không có dữ liệu thì sheet chỉ có dòng tiêu đề.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VenueExportService {

    static final String SHEET_UPCOMING = "Lịch sắp tới";
    static final String SHEET_PAST = "Booking đã qua";
    static final String SHEET_CASH = "Thu chi";

    private static final Map<String, String> BOOKING_TYPES = Map.of(
            "SINGLE", "Đơn", "SESSION", "Buổi trong gói", "WALK_IN", "Tại quầy");
    private static final Map<String, String> BOOKING_STATUSES = Map.ofEntries(
            Map.entry("HOLDING", "Đang giữ chỗ"),
            Map.entry("AWAITING_CONFIRMATION", "Chờ xác nhận"),
            Map.entry("RESUBMIT_REQUESTED", "Chờ gửi lại chứng từ"),
            Map.entry("CONFIRMED", "Đã xác nhận"),
            Map.entry("IN_USE", "Đang sử dụng"),
            Map.entry("COMPLETED", "Hoàn thành"),
            Map.entry("PAYMENT_REJECTED", "Từ chối thanh toán"),
            Map.entry("EXPIRED", "Hết hạn"),
            Map.entry("CANCELLED_BY_PLAYER", "Người chơi hủy"),
            Map.entry("CANCELLED_BY_FACILITY", "Sân hủy"));
    private static final Map<String, String> PAYMENT_SOURCES = Map.of(
            "BOOKING", "Booking", "PACKAGE", "Gói nhiều buổi", "RESCHEDULE", "Chênh lệch đổi lịch");

    private final OperationQueryRepository queryRepository;
    private final LocationAccessService locationAccess;

    public byte[] exportVenueData(UserPrincipal owner, LocalDate from, LocalDate to) {
        Location location = locationAccess.selectedLocation(owner);
        LocalDate today = LocalDate.now();
        LocalDate end = to != null ? to : today;
        LocalDate start = from != null ? from : end.withDayOfMonth(1);
        if (start.isAfter(end)) {
            throw new AppException("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
        }

        LocalDateTime now = LocalDateTime.now();
        List<BookingDetailRow> upcoming = queryRepository.findUpcomingBookings(location.getId(), today);
        List<BookingDetailRow> past = queryRepository.findBookingDetails(location.getId(), start, end).stream()
                .filter(b -> !b.getPlayDate().atTime(LocalTime.MIDNIGHT).plusMinutes(b.getEndMinute()).isAfter(now))
                .toList();
        List<IncomeRow> income = queryRepository.findConfirmedPayments(location.getId(), start, end);
        List<RefundRow> refunds = queryRepository.findRefunds(location.getId(), start, end);

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Styles styles = new Styles(workbook);
            writeUpcoming(workbook.createSheet(SHEET_UPCOMING), styles, upcoming);
            writePast(workbook.createSheet(SHEET_PAST), styles, past);
            writeCash(workbook.createSheet(SHEET_CASH), styles, income, refunds);
            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Không tạo được file Excel", e);
        }
    }

    private void writeUpcoming(Sheet sheet, Styles styles, List<BookingDetailRow> rows) {
        header(sheet, styles, "Ngày chơi", "Giờ bắt đầu", "Giờ kết thúc", "Sân", "Mã booking", "Loại",
                "Khách hàng", "Số điện thoại", "Số tiền đã trả");
        int r = 1;
        for (BookingDetailRow b : rows) {
            Row row = sheet.createRow(r++);
            date(row, 0, b.getPlayDate(), styles);
            text(row, 1, formatMinute(b.getStartMinute()));
            text(row, 2, formatMinute(b.getEndMinute()));
            text(row, 3, b.getCourtName());
            text(row, 4, b.getBookingCode());
            text(row, 5, BOOKING_TYPES.getOrDefault(b.getBookingType(), b.getBookingType()));
            text(row, 6, b.getCustomerName());
            text(row, 7, b.getCustomerPhone());
            money(row, 8, b.getFinalAmount(), styles);
        }
        autoSize(sheet, 9);
    }

    private void writePast(Sheet sheet, Styles styles, List<BookingDetailRow> rows) {
        header(sheet, styles, "Ngày chơi", "Giờ bắt đầu", "Giờ kết thúc", "Sân", "Mã booking", "Loại",
                "Khách hàng", "Số điện thoại", "Trạng thái", "Giá niêm yết", "Giảm voucher", "Giảm điểm",
                "Thành tiền");
        int r = 1;
        for (BookingDetailRow b : rows) {
            Row row = sheet.createRow(r++);
            date(row, 0, b.getPlayDate(), styles);
            text(row, 1, formatMinute(b.getStartMinute()));
            text(row, 2, formatMinute(b.getEndMinute()));
            text(row, 3, b.getCourtName());
            text(row, 4, b.getBookingCode());
            text(row, 5, BOOKING_TYPES.getOrDefault(b.getBookingType(), b.getBookingType()));
            text(row, 6, b.getCustomerName());
            text(row, 7, b.getCustomerPhone());
            text(row, 8, BOOKING_STATUSES.getOrDefault(b.getStatus(), b.getStatus()));
            money(row, 9, b.getListAmount(), styles);
            money(row, 10, b.getVoucherDiscount(), styles);
            money(row, 11, b.getPointDiscount(), styles);
            money(row, 12, b.getFinalAmount(), styles);
        }
        autoSize(sheet, 13);
    }

    /** Khoản thu (thanh toán đã xác nhận, theo ngày xác nhận) và khoản chi (hoàn tiền, theo ngày hoàn), BR37. */
    private void writeCash(Sheet sheet, Styles styles, List<IncomeRow> income, List<RefundRow> refunds) {
        header(sheet, styles, "Ngày", "Loại", "Nguồn", "Mã tham chiếu", "Số biên nhận", "Khách hàng",
                "Thu", "Chi", "Kỳ thanh toán gốc", "Ghi chú");

        List<CashLine> lines = new ArrayList<>();
        income.forEach(p -> lines.add(new CashLine(p.getConfirmedAt().toLocalDate(), "Thu",
                PAYMENT_SOURCES.getOrDefault(p.getSource(), p.getSource()), p.getReference(), p.getReceiptNo(),
                p.getCustomerName(), p.getAmount(), null, null, null)));
        refunds.forEach(f -> lines.add(new CashLine(f.getRefundDate(), "Chi", "Hoàn tiền", f.getBookingCode(), null,
                f.getCustomerName(), null, f.getAmount(), f.getOriginalPaymentDate(), f.getReason())));
        lines.sort(Comparator.comparing(CashLine::date));

        int r = 1;
        BigDecimal totalIn = BigDecimal.ZERO;
        BigDecimal totalOut = BigDecimal.ZERO;
        for (CashLine line : lines) {
            Row row = sheet.createRow(r++);
            date(row, 0, line.date(), styles);
            text(row, 1, line.kind());
            text(row, 2, line.source());
            text(row, 3, line.reference());
            text(row, 4, line.receiptNo());
            text(row, 5, line.customerName());
            money(row, 6, line.in(), styles);
            money(row, 7, line.out(), styles);
            date(row, 8, line.originalPaymentDate(), styles);
            text(row, 9, line.note());
            totalIn = totalIn.add(line.in() == null ? BigDecimal.ZERO : line.in());
            totalOut = totalOut.add(line.out() == null ? BigDecimal.ZERO : line.out());
        }
        if (!lines.isEmpty()) {
            Row total = sheet.createRow(r + 1);
            text(total, 5, "Tổng");
            money(total, 6, totalIn, styles);
            money(total, 7, totalOut, styles);
            Row net = sheet.createRow(r + 2);
            text(net, 5, "Thu ròng");
            money(net, 6, totalIn.subtract(totalOut), styles);
            total.getCell(5).setCellStyle(styles.header);
            net.getCell(5).setCellStyle(styles.header);
        }
        autoSize(sheet, 10);
    }

    private record CashLine(LocalDate date, String kind, String source, String reference, String receiptNo,
            String customerName, BigDecimal in, BigDecimal out, LocalDate originalPaymentDate, String note) {
    }

    // ---------------------------------------------------------------- cell helpers

    private static void header(Sheet sheet, Styles styles, String... titles) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < titles.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(titles[i]);
            cell.setCellStyle(styles.header);
        }
        sheet.createFreezePane(0, 1);
    }

    /** Chuỗi luôn được ghi dạng văn bản, không phải công thức, nên không có rủi ro chèn công thức. */
    private static void text(Row row, int col, String value) {
        if (value != null) {
            row.createCell(col).setCellValue(value);
        }
    }

    private static void money(Row row, int col, BigDecimal value, Styles styles) {
        if (value != null) {
            Cell cell = row.createCell(col);
            cell.setCellValue(value.doubleValue());
            cell.setCellStyle(styles.money);
        }
    }

    private static void date(Row row, int col, LocalDate value, Styles styles) {
        if (value != null) {
            Cell cell = row.createCell(col);
            cell.setCellValue(value);
            cell.setCellStyle(styles.date);
        }
    }

    /** Độ rộng cố định; autoSizeColumn cần font AWT nên dễ lỗi trên máy chủ không có giao diện. */
    private static void autoSize(Sheet sheet, int columns) {
        for (int i = 0; i < columns; i++) {
            sheet.setColumnWidth(i, 18 * 256);
        }
    }

    private static String formatMinute(int minute) {
        return String.format("%02d:%02d", (minute / 60) % 24, minute % 60);
    }

    private static final class Styles {
        final CellStyle header;
        final CellStyle money;
        final CellStyle date;

        Styles(Workbook workbook) {
            Font bold = workbook.createFont();
            bold.setBold(true);
            header = workbook.createCellStyle();
            header.setFont(bold);
            money = workbook.createCellStyle();
            money.setDataFormat(workbook.createDataFormat().getFormat("#,##0"));
            date = workbook.createCellStyle();
            date.setDataFormat(workbook.createDataFormat().getFormat("dd/MM/yyyy"));
        }
    }
}
