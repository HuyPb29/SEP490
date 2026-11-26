package com.sep490.bms.service.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.dto.booking.ScheduleResponse;
import com.sep490.bms.dto.booking.ScheduleResponse.CourtRow;
import com.sep490.bms.dto.booking.ScheduleResponse.SlotCell;
import com.sep490.bms.dto.booking.ScheduleResponse.SlotStatus;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.booking.BookingPackage;
import com.sep490.bms.entity.booking.BookingSlot;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.PackageType;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.booking.BookingPackageRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.booking.BookingSlotRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.SlotAvailabilityService.OpeningWindow;
import com.sep490.bms.service.location.CourtQueryService;
import com.sep490.bms.service.location.LocationQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Lịch sân theo ngày (UC13). Công khai cho Guest; thông tin người đặt chỉ trả cho Owner, Staff của địa điểm (BR57).
 */
@Service
@RequiredArgsConstructor
public class ScheduleService {

    /** Owner, Staff xem được 12 tháng tới để thấy các buổi trong gói đặt nhiều buổi (FR32, D175). */
    private static final int MANAGER_VIEW_MONTHS = 12;
    /** Booking đã thanh toán; các trạng thái còn lại mà slot vẫn hiệu lực là đang giữ chỗ chờ thanh toán. */
    private static final Set<BookingStatus> PAID =
            EnumSet.of(BookingStatus.CONFIRMED, BookingStatus.IN_USE, BookingStatus.COMPLETED);

    private final LocationQueryService locationQueryService;
    private final CourtQueryService courtQueryService;
    private final SlotAvailabilityService slotAvailabilityService;
    private final PriceCalculator priceCalculator;
    private final BookingSlotRepository bookingSlotRepository;
    private final BookingRepository bookingRepository;
    private final AccountRepository accountRepository;
    private final BookingPackageRepository bookingPackageRepository;
    private final PackageService packageService;

    /** date không gửi thì lấy hôm nay (UC13 #1). viewer là null khi Guest xem. */
    @Transactional(readOnly = true)
    public ScheduleResponse schedule(Long locationId, LocalDate date, UserPrincipal viewer) {
        return schedule(locationId, date, viewer, null, LocalDateTime.now());
    }

    /**
     * Lịch sân khi Player chọn slot mới để đổi lịch (UC21, UC22). bookingId là booking đang đổi;
     * buổi trong gói nhiều buổi được xem tới hết thời hạn gói vì BR31 cho đổi trong thời hạn gói.
     */
    @Transactional(readOnly = true)
    public ScheduleResponse schedule(Long locationId, LocalDate date, UserPrincipal viewer, Long bookingId) {
        return schedule(locationId, date, viewer, bookingId, false, LocalDateTime.now());
    }

    /**
     * forPackage: Player đang chọn buổi cho gói đặt nhiều buổi (UC15) hoặc slot bù, được xem lịch đúng tới ngày
     * xa nhất đặt được của gói (1 năm, không quá hạn dịch vụ; BR27, D175), không theo giới hạn đặt lẻ BR02.
     * maxDate trả về là ngày đó, FE dùng để chặn lịch chọn buổi.
     */
    @Transactional(readOnly = true)
    public ScheduleResponse schedule(Long locationId, LocalDate date, UserPrincipal viewer, Long bookingId,
            boolean forPackage) {
        return schedule(locationId, date, viewer, bookingId, forPackage, LocalDateTime.now());
    }

    /** Tách tham số now để test được theo giờ cố định. */
    ScheduleResponse schedule(Long locationId, LocalDate date, UserPrincipal viewer, LocalDateTime now) {
        return schedule(locationId, date, viewer, null, false, now);
    }

    ScheduleResponse schedule(Long locationId, LocalDate date, UserPrincipal viewer, Long bookingId, LocalDateTime now) {
        return schedule(locationId, date, viewer, bookingId, false, now);
    }

    ScheduleResponse schedule(Long locationId, LocalDate date, UserPrincipal viewer, Long bookingId,
            boolean forPackage, LocalDateTime now) {
        Location location = locationQueryService.findActive(locationId);
        boolean manager = isManager(location, viewer);
        LocalDate today = now.toLocalDate();
        LocalDate day = date != null ? date : today;
        LocalDate maxDate = maxDate(location, today, manager);
        LocalDate packageEnd = packageEndForReschedule(locationId, viewer, bookingId);
        if (packageEnd != null && packageEnd.isAfter(maxDate)) {
            maxDate = packageEnd;
        }
        LocalDate packageLimit = packageBookingLimit(locationId, viewer, today, forPackage);
        if (packageLimit != null) {
            maxDate = packageLimit;
        }
        if (day.isBefore(today) || day.isAfter(maxDate)) {
            throw new AppException("Chỉ xem được lịch sân từ hôm nay đến ngày " + maxDate);
        }

        List<Court> courts = courtQueryService.activeCourts(locationId).stream()
                .filter(c -> slotAvailabilityService.courtAvailableOn(c, day)).toList();
        List<Long> courtIds = courts.stream().map(Court::getId).toList();
        List<BookingSlot> slots = bookingSlotRepository.findByCourtIdInAndSlotDateAndActiveTrue(courtIds, day);
        Map<Long, Booking> bookings = loadBookings(slots);
        Booking rescheduling = bookingId == null ? null : bookings.get(bookingId);
        boolean canReselectOriginal = viewer != null && viewer.getRole() == Role.PLAYER
                && rescheduling != null && viewer.getId().equals(rescheduling.getPlayerId())
                && rescheduling.getLocationId().equals(locationId)
                && rescheduling.getStatus() == BookingStatus.CONFIRMED;
        List<BookingSlot> visibleSlots = slots.stream()
                .filter(slot -> !(canReselectOriginal && bookingId.equals(slot.getBookingId())
                        && inBookedFrame(slot, rescheduling)))
                .toList();

        DayView view = new DayView(
                day, now, manager,
                slotAvailabilityService.openingWindow(locationId, day),
                indexByCourtAndStart(visibleSlots), bookings,
                manager ? loadPlayers(bookings) : Map.of(),
                slotAvailabilityService.maintenanceStarts(courtIds, day),
                priceCalculator.slotPrices(courtIds, day));

        List<Integer> columns = slotAvailabilityService.scheduleRange(locationId, day)
                .map(OpeningWindow::slotStarts).orElse(List.of());
        List<CourtRow> rows = courts.stream()
                .map(c -> CourtRow.builder()
                        .courtId(c.getId())
                        .name(c.getName())
                        .slots(columns.stream().map(start -> toCell(c.getId(), start, view)).toList())
                        .build())
                .toList();
        return ScheduleResponse.builder().date(day).maxDate(maxDate).courts(rows).build();
    }

    // ---------------------------------------------------------------- Hỗ trợ

    /** Dữ liệu của ngày đang xem, tải một lần rồi dùng cho mọi ô để không truy vấn theo từng ô. */
    private record DayView(
            LocalDate date,
            LocalDateTime now,
            boolean manager,
            Optional<OpeningWindow> opening,
            Map<Long, Map<Integer, BookingSlot>> slots,
            Map<Long, Booking> bookings,
            Map<Long, Account> players,
            Map<Long, Set<Integer>> maintenance,
            Map<Long, Map<Integer, BigDecimal>> prices) {

        boolean isOpen(int start) {
            return opening.isPresent() && opening.get().covers(start, start + MinuteTime.SLOT_MINUTES);
        }

        boolean isPast(int start) {
            return date.equals(now.toLocalDate()) && start <= minuteOfDay(now);
        }
    }

    private SlotCell toCell(Long courtId, int start, DayView view) {
        SlotCell cell = SlotCell.builder().startMinute(start).time(MinuteTime.format(start)).build();
        BookingSlot slot = view.slots().getOrDefault(courtId, Map.of()).get(start);
        if (slot != null) {
            // Có booking thì luôn hiện booking, kể cả slot bị bảo trì sau đó: Owner cần biết để liên hệ khách
            Booking booking = view.bookings().get(slot.getBookingId());
            cell.setStatus(bookedStatus(slot, booking, view.now()));
            if (view.manager()) {
                fillBooker(cell, booking, view.players());
            }
        } else if (view.maintenance().getOrDefault(courtId, Set.of()).contains(start)) {
            cell.setStatus(SlotStatus.MAINTENANCE);
        } else if (!view.isOpen(start)) {
            cell.setStatus(SlotStatus.CLOSED);
        } else {
            cell.setStatus(view.isPast(start) ? SlotStatus.PAST
                    : view.prices().getOrDefault(courtId, Map.of()).containsKey(start) ? SlotStatus.AVAILABLE : SlotStatus.CLOSED);
        }
        if (cell.getStatus() != SlotStatus.CLOSED) {
            cell.setPrice(view.prices().getOrDefault(courtId, Map.of()).get(start));
        }
        return cell;
    }

    /**
     * Đang sử dụng tính theo giờ hiện tại, không đợi tác vụ tự động đổi trạng thái booking (FR33, BR44).
     * Slot nằm ngoài khung giờ hiện tại của booking là slot mới của yêu cầu đổi lịch chưa xong: đang được giữ.
     */
    private static SlotStatus bookedStatus(BookingSlot slot, Booking booking, LocalDateTime now) {
        if (!PAID.contains(booking.getStatus()) || !inBookedFrame(slot, booking)) {
            return SlotStatus.HOLDING;
        }
        int minute = minuteOfDay(now);
        boolean playing = booking.getPlayDate().equals(now.toLocalDate())
                && minute >= booking.getStartMinute() && minute < booking.getEndMinute();
        return playing ? SlotStatus.IN_USE : SlotStatus.BOOKED;
    }

    private static boolean inBookedFrame(BookingSlot slot, Booking booking) {
        return slot.getCourtId().equals(booking.getCourtId())
                && slot.getSlotDate().equals(booking.getPlayDate())
                && slot.getSlotStartMinute() >= booking.getStartMinute()
                && slot.getSlotStartMinute() < booking.getEndMinute();
    }

    /** Booking của Player lấy từ tài khoản; booking tại quầy lấy tên, SĐT khách đã nhập (FR34). */
    private static void fillBooker(SlotCell cell, Booking booking, Map<Long, Account> players) {
        Account player = players.get(booking.getPlayerId());
        cell.setBookerName(player != null ? player.getFullName() : booking.getCustomerName());
        cell.setBookerPhone(player != null ? player.getPhone() : booking.getCustomerPhone());
        cell.setNote(booking.getNote());
    }

    /** Owner của địa điểm hoặc Staff thuộc địa điểm; Owner, Staff nơi khác xem như Guest (BR60). */
    private static boolean isManager(Location location, UserPrincipal viewer) {
        if (viewer == null) {
            return false;
        }
        return (viewer.getRole() == Role.OWNER && viewer.getId().equals(location.getOwnerId()))
                || (viewer.getRole() == Role.STAFF && location.getId().equals(viewer.getLocationId()));
    }

    /**
     * Ngày kết thúc gói của buổi Player đang đổi lịch (BR31). Trả null khi không áp dụng: không phải Player,
     * booking không thuộc Player hoặc địa điểm này, booking lẻ, hoặc thuộc đơn đặt lẻ trong ngày (BR64 theo BR02).
     */
    private LocalDate packageEndForReschedule(Long locationId, UserPrincipal viewer, Long bookingId) {
        if (bookingId == null || viewer == null || viewer.getRole() != Role.PLAYER) {
            return null;
        }
        Booking booking = bookingRepository.findById(bookingId).orElse(null);
        if (booking == null || booking.getPackageId() == null
                || !viewer.getId().equals(booking.getPlayerId()) || !locationId.equals(booking.getLocationId())) {
            return null;
        }
        return bookingPackageRepository.findById(booking.getPackageId())
                .filter(pkg -> pkg.getPackageType() != PackageType.DAY)
                .map(BookingPackage::getEndDate)
                .orElse(null);
    }

    /**
     * Ngày xa nhất Player xem được khi chọn buổi cho gói: cùng mốc với PackageService (1 năm tính cả hôm nay,
     * không quá hạn dịch vụ của địa điểm, D175). Trả null khi không phải Player hoặc không xem cho gói.
     */
    private LocalDate packageBookingLimit(Long locationId, UserPrincipal viewer, LocalDate today, boolean forPackage) {
        if (!forPackage || viewer == null || viewer.getRole() != Role.PLAYER) {
            return null;
        }
        return packageService.lastBookablePackageDate(locationId, today);
    }

    private static LocalDate maxDate(Location location, LocalDate today, boolean manager) {
        LocalDate bookable = today.plusDays(location.getAdvanceBookingDays());
        if (!manager) {
            return bookable;
        }
        LocalDate managerLimit = today.plusMonths(MANAGER_VIEW_MONTHS);
        return managerLimit.isAfter(bookable) ? managerLimit : bookable;
    }

    private Map<Long, Booking> loadBookings(List<BookingSlot> slots) {
        Set<Long> ids = slots.stream().map(BookingSlot::getBookingId).collect(Collectors.toSet());
        return bookingRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Booking::getId, Function.identity()));
    }

    private Map<Long, Account> loadPlayers(Map<Long, Booking> bookings) {
        Set<Long> ids = bookings.values().stream().map(Booking::getPlayerId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        return accountRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Account::getId, Function.identity()));
    }

    private static Map<Long, Map<Integer, BookingSlot>> indexByCourtAndStart(List<BookingSlot> slots) {
        Map<Long, Map<Integer, BookingSlot>> index = new HashMap<>();
        for (BookingSlot slot : slots) {
            index.computeIfAbsent(slot.getCourtId(), k -> new HashMap<>()).put(slot.getSlotStartMinute(), slot);
        }
        return index;
    }

    private static int minuteOfDay(LocalDateTime time) {
        return time.getHour() * 60 + time.getMinute();
    }
}
