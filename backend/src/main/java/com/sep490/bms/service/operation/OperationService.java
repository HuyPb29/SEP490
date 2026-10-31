package com.sep490.bms.service.operation;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.dto.operation.BookingReportResponse;
import com.sep490.bms.dto.operation.OccupancyReportResponse;
import com.sep490.bms.dto.operation.RevenueReportResponse;
import com.sep490.bms.dto.operation.StaffDashboardResponse;
import com.sep490.bms.entity.Location;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.repository.operation.OperationQueryRepository;
import com.sep490.bms.repository.operation.OperationQueryRepository.AmountRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.BookingCountRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.BookingDetailRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.CourtRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.OpeningRow;
import com.sep490.bms.repository.operation.OperationQueryRepository.SlotRow;
import com.sep490.bms.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/** F9 – UC34 bảng điều hành Staff, UC35 báo cáo vận hành và doanh thu, UC36 tải dữ liệu quản lý. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OperationService {

    private static final long MAX_RANGE_DAYS = 366;
    private static final int SLOT_MINUTES = 30;
    private static final Set<String> VALID_STATUSES = Set.of("CONFIRMED", "IN_USE", "COMPLETED");
    private static final Set<String> CANCELLED_STATUSES = Set.of("CANCELLED_BY_PLAYER", "CANCELLED_BY_FACILITY");

    private final OperationQueryRepository queryRepository;
    private final LocationRepository locationRepository;
    private final LocationAccessService locationAccess;

    // ---------------------------------------------------------------- UC34 – Bảng điều hành Staff

    public StaffDashboardResponse getStaffDashboard(UserPrincipal staff) {
        Long locationId = staff.getLocationId();
        Location location = locationRepository.findById(locationId)
                .orElseThrow(() -> new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));
        LocalDate today = LocalDate.now();

        List<BookingDetailRow> rows = queryRepository.findBookingDetails(locationId, today, today);
        Map<String, Long> byStatus = new LinkedHashMap<>();
        rows.forEach(r -> byStatus.merge(r.getStatus(), 1L, Long::sum));

        BigDecimal todayRevenue = queryRepository.sumConfirmedPayments(locationId, today, today).stream()
                .map(AmountRow::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        return StaffDashboardResponse.builder()
                .locationId(locationId)
                .locationName(location.getName())
                .date(today)
                .bookingsByStatus(byStatus)
                .todayBookings(rows.stream().map(r -> StaffDashboardResponse.BookingItem.builder()
                        .id(r.getId())
                        .bookingCode(r.getBookingCode())
                        .courtName(r.getCourtName())
                        .startMinute(r.getStartMinute())
                        .endMinute(r.getEndMinute())
                        .customerName(r.getCustomerName())
                        .customerPhone(r.getCustomerPhone())
                        .status(r.getStatus())
                        .finalAmount(r.getFinalAmount())
                        .build()).toList())
                .paymentsAwaitingConfirmation(queryRepository.countPaymentsAwaitingConfirmation(locationId))
                .complaintsToForward(queryRepository.countComplaintsByStatus(locationId, "SUBMITTED"))
                .todayRevenue(todayRevenue)
                .reconciledToday(queryRepository.existsReconciliation(locationId, today))
                .build();
    }

    // ---------------------------------------------------------------- UC35 – Báo cáo

    public BookingReportResponse getBookingReport(UserPrincipal owner, LocalDate from, LocalDate to) {
        Location location = findOwnerLocation(owner);
        LocalDate[] range = resolveRange(from, to);
        return buildBookingReport(location.getId(), range[0], range[1]);
    }

    public RevenueReportResponse getRevenueReport(UserPrincipal owner, LocalDate from, LocalDate to) {
        Location location = findOwnerLocation(owner);
        LocalDate[] range = resolveRange(from, to);
        return buildRevenueReport(location.getId(), range[0], range[1]);
    }

    public OccupancyReportResponse getOccupancyReport(UserPrincipal owner, LocalDate from, LocalDate to) {
        Location location = findOwnerLocation(owner);
        LocalDate[] range = resolveRange(from, to);
        return buildOccupancyReport(location.getId(), range[0], range[1]);
    }

    private BookingReportResponse buildBookingReport(Long locationId, LocalDate from, LocalDate to) {
        List<BookingCountRow> rows = queryRepository.countBookings(locationId, from, to);

        Map<String, Long> byStatus = new TreeMap<>();
        Map<LocalDate, long[]> byDay = new TreeMap<>();
        Map<Long, Object[]> byCourt = new LinkedHashMap<>();
        long total = 0;
        long valid = 0;
        long cancelled = 0;
        for (BookingCountRow r : rows) {
            boolean isValid = VALID_STATUSES.contains(r.getStatus());
            total += r.getCount();
            if (isValid) {
                valid += r.getCount();
            }
            if (CANCELLED_STATUSES.contains(r.getStatus())) {
                cancelled += r.getCount();
            }
            byStatus.merge(r.getStatus(), r.getCount(), Long::sum);

            long[] day = byDay.computeIfAbsent(r.getPlayDate(), d -> new long[2]);
            day[0] += r.getCount();
            day[1] += isValid ? r.getCount() : 0;

            Object[] court = byCourt.computeIfAbsent(r.getCourtId(), id -> new Object[] { r.getCourtName(), new long[2] });
            long[] counts = (long[]) court[1];
            counts[0] += r.getCount();
            counts[1] += isValid ? r.getCount() : 0;
        }

        List<BookingReportResponse.DayItem> daily = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            long[] c = byDay.getOrDefault(d, new long[2]);
            daily.add(BookingReportResponse.DayItem.builder().date(d).total(c[0]).valid(c[1]).build());
        }
        List<BookingReportResponse.CourtItem> courts = new ArrayList<>();
        byCourt.forEach((id, v) -> {
            long[] c = (long[]) v[1];
            courts.add(BookingReportResponse.CourtItem.builder()
                    .courtId(id).courtName((String) v[0]).total(c[0]).valid(c[1]).build());
        });

        return BookingReportResponse.builder()
                .from(from).to(to)
                .totalBookings(total)
                .validBookings(valid)
                .cancelledBookings(cancelled)
                .cancellationRate(total == 0 ? 0 : round((double) cancelled / total))
                .byStatus(byStatus)
                .daily(daily)
                .byCourt(courts)
                .build();
    }

    private RevenueReportResponse buildRevenueReport(Long locationId, LocalDate from, LocalDate to) {
        Map<LocalDate, AmountRow> revenue = new HashMap<>();
        queryRepository.sumConfirmedPayments(locationId, from, to).forEach(r -> revenue.put(r.getDate(), r));
        Map<LocalDate, AmountRow> refunds = new HashMap<>();
        queryRepository.sumRefunds(locationId, from, to).forEach(r -> refunds.put(r.getDate(), r));

        List<RevenueReportResponse.DayItem> daily = new ArrayList<>();
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalRefunds = BigDecimal.ZERO;
        long paymentCount = 0;
        long refundCount = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            AmountRow rev = revenue.get(d);
            AmountRow ref = refunds.get(d);
            BigDecimal revAmount = rev == null ? BigDecimal.ZERO : rev.getAmount();
            BigDecimal refAmount = ref == null ? BigDecimal.ZERO : ref.getAmount();
            totalRevenue = totalRevenue.add(revAmount);
            totalRefunds = totalRefunds.add(refAmount);
            paymentCount += rev == null ? 0 : rev.getCount();
            refundCount += ref == null ? 0 : ref.getCount();
            daily.add(RevenueReportResponse.DayItem.builder()
                    .date(d).revenue(revAmount).refunds(refAmount).net(revAmount.subtract(refAmount)).build());
        }
        return RevenueReportResponse.builder()
                .from(from).to(to)
                .totalRevenue(totalRevenue)
                .totalRefunds(totalRefunds)
                .netRevenue(totalRevenue.subtract(totalRefunds))
                .paymentCount(paymentCount)
                .refundCount(refundCount)
                .daily(daily)
                .build();
    }

    private OccupancyReportResponse buildOccupancyReport(Long locationId, LocalDate from, LocalDate to) {
        List<CourtRow> courts = queryRepository.findActiveCourts(locationId);

        Map<Integer, OpeningRow> weekly = new HashMap<>();
        queryRepository.findOpeningHours(locationId).forEach(o -> weekly.put(o.getDayOfWeek(), o));
        Map<LocalDate, OpeningRow> exceptions = new HashMap<>();
        queryRepository.findOpeningExceptions(locationId, from, to).forEach(o -> exceptions.put(o.getDate(), o));

        Map<LocalDate, Long> bookedByDay = new HashMap<>();
        Map<Long, Long> bookedByCourt = new HashMap<>();
        for (SlotRow s : queryRepository.countBookedSlots(locationId, from, to)) {
            bookedByDay.merge(s.getDate(), s.getSlots(), Long::sum);
            bookedByCourt.merge(s.getCourtId(), s.getSlots(), Long::sum);
        }

        long totalAvailablePerCourt = 0;
        List<OccupancyReportResponse.DayItem> daily = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            long perCourt = slotsPerCourt(d, weekly, exceptions);
            totalAvailablePerCourt += perCourt;
            long available = perCourt * courts.size();
            long booked = bookedByDay.getOrDefault(d, 0L);
            daily.add(OccupancyReportResponse.DayItem.builder()
                    .date(d).availableSlots(available).bookedSlots(booked).occupancyRate(rate(booked, available))
                    .build());
        }

        List<OccupancyReportResponse.CourtItem> byCourt = new ArrayList<>();
        long totalBooked = 0;
        for (CourtRow c : courts) {
            long booked = bookedByCourt.getOrDefault(c.getId(), 0L);
            totalBooked += booked;
            byCourt.add(OccupancyReportResponse.CourtItem.builder()
                    .courtId(c.getId()).courtName(c.getName())
                    .availableSlots(totalAvailablePerCourt).bookedSlots(booked)
                    .occupancyRate(rate(booked, totalAvailablePerCourt))
                    .build());
        }
        long totalAvailable = totalAvailablePerCourt * courts.size();
        return OccupancyReportResponse.builder()
                .from(from).to(to)
                .availableSlots(totalAvailable)
                .bookedSlots(totalBooked)
                .occupancyRate(rate(totalBooked, totalAvailable))
                .daily(daily)
                .byCourt(byCourt)
                .build();
    }

    /** Ngoại lệ ghi đè giờ theo thứ; không có dòng nào nghĩa là ngày đó đóng cửa (BR04). */
    private long slotsPerCourt(LocalDate date, Map<Integer, OpeningRow> weekly, Map<LocalDate, OpeningRow> exceptions) {
        OpeningRow row = exceptions.get(date);
        if (row == null) {
            DayOfWeek dow = date.getDayOfWeek();
            row = weekly.get(dow.getValue());
        }
        return row == null ? 0 : (row.getCloseMinute() - row.getOpenMinute()) / SLOT_MINUTES;
    }

    // ---------------------------------------------------------------- UC36 – Tải dữ liệu (CSV)

    public byte[] exportBookings(UserPrincipal owner, LocalDate from, LocalDate to) {
        Location location = findOwnerLocation(owner);
        LocalDate[] range = resolveRange(from, to);
        CsvBuilder csv = new CsvBuilder("Mã booking", "Loại", "Sân", "Ngày chơi", "Giờ bắt đầu", "Giờ kết thúc",
                "Khách hàng", "Số điện thoại", "Trạng thái", "Giá niêm yết", "Giảm voucher", "Giảm điểm",
                "Thành tiền");
        for (BookingDetailRow r : queryRepository.findBookingDetails(location.getId(), range[0], range[1])) {
            csv.row(r.getBookingCode(), r.getBookingType(), r.getCourtName(), r.getPlayDate(),
                    formatMinute(r.getStartMinute()), formatMinute(r.getEndMinute()), r.getCustomerName(),
                    r.getCustomerPhone(), r.getStatus(), r.getListAmount(), r.getVoucherDiscount(),
                    r.getPointDiscount(), r.getFinalAmount());
        }
        return csv.toBytes();
    }

    public byte[] exportRevenue(UserPrincipal owner, LocalDate from, LocalDate to) {
        Location location = findOwnerLocation(owner);
        LocalDate[] range = resolveRange(from, to);
        RevenueReportResponse report = buildRevenueReport(location.getId(), range[0], range[1]);
        CsvBuilder csv = new CsvBuilder("Ngày", "Doanh thu", "Đã hoàn", "Doanh thu ròng");
        for (RevenueReportResponse.DayItem d : report.getDaily()) {
            csv.row(d.getDate(), d.getRevenue(), d.getRefunds(), d.getNet());
        }
        csv.row("Tổng", report.getTotalRevenue(), report.getTotalRefunds(), report.getNetRevenue());
        return csv.toBytes();
    }

    // ---------------------------------------------------------------- helpers

    private Location findOwnerLocation(UserPrincipal owner) {
        return locationAccess.selectedLocation(owner);
    }

    /** Mặc định từ đầu tháng đến hôm nay; tối đa 366 ngày. */
    private LocalDate[] resolveRange(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.withDayOfMonth(1);
        if (start.isAfter(end)) {
            throw new AppException("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
        }
        if (ChronoUnit.DAYS.between(start, end) + 1 > MAX_RANGE_DAYS) {
            throw new AppException("Khoảng thời gian tối đa là " + MAX_RANGE_DAYS + " ngày");
        }
        return new LocalDate[] { start, end };
    }

    private static double rate(long booked, long available) {
        return available == 0 ? 0 : round((double) booked / available);
    }

    private static double round(double value) {
        return Math.round(value * 10000d) / 10000d;
    }

    private static String formatMinute(int minute) {
        return String.format("%02d:%02d", (minute / 60) % 24, minute % 60);
    }

    /** CSV UTF-8 có BOM để Excel đọc đúng tiếng Việt. */
    private static class CsvBuilder {
        private final StringBuilder sb = new StringBuilder("﻿");

        CsvBuilder(String... headers) {
            row((Object[]) headers);
        }

        void row(Object... cells) {
            for (int i = 0; i < cells.length; i++) {
                if (i > 0) {
                    sb.append(',');
                }
                sb.append(escape(cells[i]));
            }
            sb.append("\r\n");
        }

        private static String escape(Object cell) {
            if (cell == null) {
                return "";
            }
            String text = cell instanceof BigDecimal d ? d.toPlainString() : cell.toString();
            // Chặn CSV injection khi mở bằng Excel.
            if (!text.isEmpty() && "=+-@".indexOf(text.charAt(0)) >= 0 && !(cell instanceof Number)) {
                text = "'" + text;
            }
            if (text.contains(",") || text.contains("\"") || text.contains("\n") || text.contains("\r")) {
                return "\"" + text.replace("\"", "\"\"") + "\"";
            }
            return text;
        }

        byte[] toBytes() {
            return sb.toString().getBytes(StandardCharsets.UTF_8);
        }
    }
}
