package com.sep490.bms.service.booking;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.dto.booking.BatchOfferPublicResponse;
import com.sep490.bms.dto.booking.PackagePreviewResponse;
import com.sep490.bms.dto.booking.PackagePreviewResponse.Conflict;
import com.sep490.bms.dto.booking.PackageRequest;
import com.sep490.bms.dto.booking.PackageRequest.WeeklySlot;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.enums.PackageType;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.promotion.Voucher;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.BatchOfferRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.promotion.VoucherRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.LocationQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Đặt nhiều buổi (UC15): gói (booking tổng) gồm nhiều buổi con, thanh toán một lần (BR10, BR26).
 * Định kỳ hay tự chọn chỉ là cách nhập buổi; sau khi xác nhận lịch, gói là danh sách buổi con (BR27).
 */
@Service
@RequiredArgsConstructor
public class PackageService {

    /** BR27: định kỳ kéo dài từ 1 đến 3 tháng. */
    static final int MIN_MONTHS = 1;
    static final int MAX_MONTHS = 3;

    private final LocationQueryService locationQueryService;
    private final BatchOfferRepository batchOfferRepository;
    private final VoucherRepository voucherRepository;
    private final CourtRepository courtRepository;
    private final BookingService bookingService;
    private final SlotAvailabilityService slotAvailabilityService;

    /**
     * UC15 #9, FR44: chương trình ưu đãi đặt theo lô đang diễn ra của một địa điểm, công khai.
     * Đang diễn ra = hôm nay nằm trong khoảng ngày của chương trình và voucher tặng còn ở trạng thái
     * đã phát hành (voucher bị vô hiệu hóa thì không tặng được nữa).
     */
    @Transactional(readOnly = true)
    public List<BatchOfferPublicResponse> listActiveBatchOffers(Long locationId) {
        return listActiveBatchOffers(locationId, LocalDate.now());
    }

    List<BatchOfferPublicResponse> listActiveBatchOffers(Long locationId, LocalDate today) {
        locationQueryService.findActive(locationId);
        List<BatchOffer> offers = batchOfferRepository.findAllByLocationIdOrderByStartDateDescIdDesc(locationId)
                .stream()
                .filter(offer -> !today.isBefore(offer.getStartDate()) && !today.isAfter(offer.getEndDate()))
                .toList();
        if (offers.isEmpty()) {
            return List.of();
        }
        Map<Long, Voucher> vouchers = voucherRepository
                .findAllById(offers.stream().map(BatchOffer::getVoucherId).distinct().toList()).stream()
                .collect(Collectors.toMap(Voucher::getId, Function.identity()));
        return offers.stream()
                .filter(offer -> isPublished(vouchers.get(offer.getVoucherId())))
                .sorted(Comparator.comparing(BatchOffer::getStartDate).thenComparing(BatchOffer::getId))
                .map(offer -> BatchOfferPublicResponse.from(offer, vouchers.get(offer.getVoucherId())))
                .toList();
    }

    /**
     * UC15 #1–2, #4: Player nhập mẫu rồi xem lịch toàn kỳ trước khi bấm xác nhận lịch.
     * Không tạo gói, không giữ chỗ: gói chỉ giữ chỗ từ lúc bấm xác nhận lịch (BR53).
     */
    @Transactional(readOnly = true)
    public PackagePreviewResponse preview(UserPrincipal player, PackageRequest request) {
        return preview(player, request, LocalDateTime.now());
    }

    PackagePreviewResponse preview(UserPrincipal player, PackageRequest request, LocalDateTime now) {
        Court court = courtRepository.findByIdAndActiveTrue(request.courtId())
                .orElseThrow(() -> new AppException("Không tìm thấy sân", HttpStatus.NOT_FOUND));
        Location location = locationQueryService.findActive(court.getLocationId());
        bookingService.requireOwnTeam(player.getId(), request.teamId());

        List<Planned> sessions = markConflicts(location, plan(request, court, now.toLocalDate()), now);
        int conflicts = (int) sessions.stream().filter(Planned::hasConflict).count();
        return PackagePreviewResponse.builder()
                .locationId(location.getId())
                .locationName(location.getName())
                .packageType(request.packageType())
                .startDate(sessions.get(0).date())
                .endDate(sessions.get(sessions.size() - 1).date())
                .totalSessions(sessions.size())
                .conflictSessions(conflicts)
                .summary("Tổng " + sessions.size() + " buổi, " + conflicts + " buổi bị trùng.")
                .months(monthSummaries(sessions))
                .sessions(sessions.stream().map(PackageService::toResponse).toList())
                .build();
    }

    /**
     * Một buổi con dự kiến của gói: một sân, một ngày, các slot liền nhau [startMinute, endMinute).
     * conflict trống là đặt được.
     */
    record Planned(LocalDate date, Court court, int startMinute, int endMinute, Conflict conflict) {

        Planned(LocalDate date, Court court, int startMinute, int endMinute) {
            this(date, court, startMinute, endMinute, null);
        }

        boolean hasConflict() {
            return conflict != null;
        }

        Planned withConflict(Conflict value) {
            return new Planned(date, court, startMinute, endMinute, value);
        }
    }

    /**
     * Danh sách buổi của gói theo ngày giờ chơi. Định kỳ: luôn kiểm mẫu ban đầu (MSG41); Player gửi danh sách
     * đã xử lý buổi trùng thì dùng danh sách đó, các buổi phải nằm trong thời gian của mẫu. Tự chọn: các buổi
     * Player chọn, ít nhất 2 buổi, trong vòng 3 tháng (MSG91).
     */
    List<Planned> plan(PackageRequest request, Court court, LocalDate today) {
        List<Planned> sessions;
        if (request.packageType() == PackageType.RECURRING) {
            List<Planned> generated = generateRecurring(request, court, today);
            if (request.sessions() == null) {
                return generated;
            }
            sessions = explicitSessions(request, court, today);
            for (Planned session : sessions) {
                if (session.date().isBefore(request.startDate()) || session.date().isAfter(request.endDate())) {
                    throw new AppException("Buổi ngày " + session.date() + " nằm ngoài thời gian đặt định kỳ ("
                            + request.startDate() + " – " + request.endDate() + ").");
                }
            }
        } else {
            if (request.sessions() == null || request.sessions().size() < 2) {
                throw invalidCustom();
            }
            sessions = explicitSessions(request, court, today);
            LocalDate first = sessions.get(0).date();
            LocalDate last = sessions.get(sessions.size() - 1).date();
            if (last.plusDays(1).isAfter(first.plusMonths(MAX_MONTHS))) {
                throw invalidCustom();
            }
        }
        if (sessions.isEmpty()) {
            throw tooFewSessions();
        }
        return sessions;
    }

    /**
     * Buổi Player gửi: sân để trống là sân của gói, sân khác phải đang hoạt động và cùng địa điểm; không trước
     * hôm nay; hai buổi trên cùng sân cùng ngày không được chồng giờ.
     */
    private List<Planned> explicitSessions(PackageRequest request, Court packageCourt, LocalDate today) {
        Map<Long, Court> courts = new HashMap<>();
        courts.put(packageCourt.getId(), packageCourt);
        List<Planned> sessions = new ArrayList<>();
        for (PackageRequest.Session input : request.sessions()) {
            requireValidRange(input.startMinute(), input.endMinute());
            if (input.date().isBefore(today)) {
                throw new AppException("Buổi ngày " + input.date() + " đã qua.");
            }
            Long courtId = input.courtId() == null ? packageCourt.getId() : input.courtId();
            Court court = courts.computeIfAbsent(courtId, id -> courtRepository.findByIdAndActiveTrue(id)
                    .filter(found -> found.getLocationId().equals(packageCourt.getLocationId()))
                    .orElseThrow(() -> new AppException("Sân của buổi ngày " + input.date()
                            + " không thuộc địa điểm này hoặc đang tắt.")));
            sessions.add(new Planned(input.date(), court, input.startMinute(), input.endMinute()));
        }
        sessions.sort(SESSION_ORDER);
        for (int i = 0; i < sessions.size(); i++) {
            for (int j = i + 1; j < sessions.size(); j++) {
                Planned a = sessions.get(i);
                Planned b = sessions.get(j);
                if (a.date().equals(b.date()) && a.court().getId().equals(b.court().getId())
                        && a.startMinute() < b.endMinute() && b.startMinute() < a.endMinute()) {
                    throw new AppException("Hai buổi ngày " + a.date() + " trên " + a.court().getName()
                            + " bị chồng giờ nhau.");
                }
            }
        }
        return sessions;
    }

    /**
     * UC15 #4–5, FR41, FR42, BR50: đánh dấu buổi bị trùng (đã có người giữ/đặt, bảo trì, ngoài giờ mở cửa);
     * buổi hôm nay đã đến giờ bắt đầu cũng không đặt được. Gói không bị giới hạn đặt trước của BR02 (BR27).
     */
    private List<Planned> markConflicts(Location location, List<Planned> sessions, LocalDateTime now) {
        LocalDate today = now.toLocalDate();
        int nowMinute = now.getHour() * 60 + now.getMinute();
        return sessions.stream().map(session -> {
            if (session.date().equals(today) && session.startMinute() <= nowMinute) {
                return session.withConflict(Conflict.STARTED);
            }
            return slotAvailabilityService.findProblem(location.getId(), session.court().getId(), session.date(),
                    session.startMinute(), session.endMinute())
                    .map(problem -> session.withConflict(switch (problem) {
                        case TAKEN -> Conflict.TAKEN;
                        case MAINTENANCE -> Conflict.MAINTENANCE;
                        case CLOSED -> Conflict.CLOSED;
                    }))
                    .orElse(session);
        }).toList();
    }

    /** FR45: lịch theo từng tháng kèm tổng số buổi và số buổi bị trùng. */
    private static List<PackagePreviewResponse.MonthSummary> monthSummaries(List<Planned> sessions) {
        Map<YearMonth, List<Planned>> byMonth = sessions.stream()
                .collect(Collectors.groupingBy(s -> YearMonth.from(s.date()), TreeMap::new, Collectors.toList()));
        return byMonth.entrySet().stream()
                .map(e -> PackagePreviewResponse.MonthSummary.builder()
                        .month(e.getKey().toString())
                        .totalSessions(e.getValue().size())
                        .conflictSessions((int) e.getValue().stream().filter(Planned::hasConflict).count())
                        .build())
                .toList();
    }

    private static final Comparator<Planned> SESSION_ORDER = Comparator.comparing(Planned::date)
            .thenComparing(Planned::startMinute)
            .thenComparing(p -> p.court().getId());

    /**
     * UC15 #2, BR27 (a): sinh các buổi từ mẫu định kỳ, mỗi ngày trong khoảng [startDate, endDate] trùng thứ
     * của một dòng mẫu là một buổi. Mẫu phải có ít nhất 1 buổi/tuần và kéo dài 1–3 tháng (MSG41); điều kiện
     * này chỉ kiểm trên mẫu ban đầu, không kiểm lại sau khi bỏ buổi trùng (D50).
     */
    List<Planned> generateRecurring(PackageRequest request, Court court, LocalDate today) {
        List<WeeklySlot> pattern = request.weeklySlots();
        LocalDate start = request.startDate();
        LocalDate end = request.endDate();
        if (pattern == null || pattern.isEmpty() || start == null || end == null || !isWithinMonths(start, end)) {
            throw invalidRecurring();
        }
        if (start.isBefore(today)) {
            throw new AppException("Ngày bắt đầu không được trước hôm nay.");
        }
        requireValidPattern(pattern);

        List<WeeklySlot> sorted = pattern.stream()
                .sorted(Comparator.comparing(WeeklySlot::dayOfWeek).thenComparing(WeeklySlot::startMinute))
                .toList();
        List<Planned> sessions = new ArrayList<>();
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            int dayOfWeek = date.getDayOfWeek().getValue();
            for (WeeklySlot slot : sorted) {
                if (slot.dayOfWeek() == dayOfWeek) {
                    sessions.add(new Planned(date, court, slot.startMinute(), slot.endMinute()));
                }
            }
        }
        return sessions;
    }

    /**
     * BR27: từ 1 đến 3 tháng, tính cả ngày cuối (cùng cách đếm với hạn dịch vụ DR29):
     * 01/12–31/12 là đủ 1 tháng, 01/12–28/02 là 3 tháng.
     */
    static boolean isWithinMonths(LocalDate start, LocalDate end) {
        LocalDate dayAfterEnd = end.plusDays(1);
        return !end.isBefore(start)
                && !dayAfterEnd.isBefore(start.plusMonths(MIN_MONTHS))
                && !dayAfterEnd.isAfter(start.plusMonths(MAX_MONTHS));
    }

    /** Khung giờ theo bước 30 phút; hai dòng cùng thứ không được chồng giờ nhau. */
    private static void requireValidPattern(List<WeeklySlot> pattern) {
        for (WeeklySlot slot : pattern) {
            requireValidRange(slot.startMinute(), slot.endMinute());
        }
        for (int i = 0; i < pattern.size(); i++) {
            for (int j = i + 1; j < pattern.size(); j++) {
                WeeklySlot a = pattern.get(i);
                WeeklySlot b = pattern.get(j);
                if (a.dayOfWeek().equals(b.dayOfWeek()) && a.startMinute() < b.endMinute()
                        && b.startMinute() < a.endMinute()) {
                    throw new AppException("Hai buổi trong mẫu định kỳ bị chồng giờ vào cùng một thứ.");
                }
            }
        }
    }

    static void requireValidRange(int startMinute, int endMinute) {
        if (startMinute < 0 || endMinute > MinuteTime.DAY_MINUTES || endMinute <= startMinute
                || !MinuteTime.isSlotBoundary(startMinute) || !MinuteTime.isSlotBoundary(endMinute)) {
            throw new AppException("Slot phải theo bước 30 phút và giờ kết thúc sau giờ bắt đầu");
        }
    }

    private static AppException invalidCustom() {
        return new AppException("Đặt tự chọn cần ít nhất 2 buổi, trong vòng tối đa 3 tháng. (MSG91)");
    }

    static AppException tooFewSessions() {
        return new AppException(
                "Gói phải còn ít nhất 2 buổi. Vui lòng chọn slot bù cho các buổi bị trùng thay vì bỏ. (MSG92)");
    }

    private static AppException invalidRecurring() {
        return new AppException("Đặt định kỳ cần ít nhất 1 buổi mỗi tuần, thời gian từ 1 đến 3 tháng. (MSG41)");
    }

    private static PackagePreviewResponse.Session toResponse(Planned session) {
        return PackagePreviewResponse.Session.builder()
                .date(session.date())
                .courtId(session.court().getId())
                .courtName(session.court().getName())
                .startMinute(session.startMinute())
                .endMinute(session.endMinute())
                .startTime(MinuteTime.format(session.startMinute()))
                .endTime(MinuteTime.format(session.endMinute()))
                .conflict(session.conflict())
                .build();
    }

    private static boolean isPublished(Voucher voucher) {
        return voucher != null && voucher.getStatus() == VoucherStatus.PUBLISHED;
    }
}
