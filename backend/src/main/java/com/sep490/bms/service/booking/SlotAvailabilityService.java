package com.sep490.bms.service.booking;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.entity.booking.BookingSlot;
import com.sep490.bms.entity.enums.ApprovalStatus;
import com.sep490.bms.entity.location.Maintenance;
import com.sep490.bms.repository.booking.BookingSlotRepository;
import com.sep490.bms.repository.location.MaintenanceRepository;
import com.sep490.bms.repository.location.OpeningExceptionRepository;
import com.sep490.bms.repository.location.OpeningHourRepository;

import lombok.RequiredArgsConstructor;

/**
 * Slot nào của một ngày còn đặt được: trong giờ mở cửa, chưa ai giữ/đặt, không trùng bảo trì đã duyệt.
 * Dùng chung cho lịch sân (UC13), đặt sân lẻ (UC14), đặt nhiều buổi (UC15), đặt tại quầy (UC16).
 * Chỉ trả lời "slot có trống không"; kiểm tra địa điểm/sân đang hoạt động và hạn đặt trước là việc của service gọi.
 */
@Service
@RequiredArgsConstructor
public class SlotAvailabilityService {

    private final OpeningHourRepository openingHourRepository;
    private final OpeningExceptionRepository openingExceptionRepository;
    private final BookingSlotRepository bookingSlotRepository;
    private final MaintenanceRepository maintenanceRepository;

    /** Giờ mở cửa của một ngày, tính bằng số phút [openMinute, closeMinute). */
    public record OpeningWindow(int openMinute, int closeMinute) {

        /** Phút bắt đầu của từng slot 30 phút trong giờ mở cửa. */
        public List<Integer> slotStarts() {
            List<Integer> starts = new ArrayList<>();
            for (int m = openMinute; m < closeMinute; m += MinuteTime.SLOT_MINUTES) {
                starts.add(m);
            }
            return starts;
        }

        public boolean covers(int startMinute, int endMinute) {
            return startMinute >= openMinute && endMinute <= closeMinute;
        }
    }

    /**
     * Ngày ngoại lệ (BR04) được ưu tiên hơn giờ mở cửa theo thứ (FR18).
     * Không có dòng nào thì ngày đó đóng cửa: trả về rỗng.
     */
    @Transactional(readOnly = true)
    public Optional<OpeningWindow> openingWindow(Long locationId, LocalDate date) {
        var exception = openingExceptionRepository.findByLocationIdAndExceptionDate(locationId, date);
        if (exception.isPresent()) {
            return Optional.of(new OpeningWindow(exception.get().getOpenMinute(), exception.get().getCloseMinute()));
        }
        return openingHourRepository.findByLocationIdAndDayOfWeek(locationId, date.getDayOfWeek().getValue())
                .map(h -> new OpeningWindow(h.getOpenMinute(), h.getCloseMinute()));
    }

    /**
     * Khoảng cột của lịch sân: từ giờ mở sớm nhất đến giờ đóng muộn nhất trong tuần, tính cả ngày đang xem
     * vì ngày ngoại lệ có thể rộng hơn. Nhờ vậy cột không đổi khi chuyển ngày, phần ngoài giờ của ngày đó
     * hiện là "ngoài giờ mở cửa" (FR33). Địa điểm chưa cài giờ mở cửa thì trả về rỗng.
     */
    @Transactional(readOnly = true)
    public Optional<OpeningWindow> scheduleRange(Long locationId, LocalDate date) {
        List<OpeningWindow> windows = new ArrayList<>();
        openingHourRepository.findAllByLocationIdOrderByDayOfWeek(locationId)
                .forEach(h -> windows.add(new OpeningWindow(h.getOpenMinute(), h.getCloseMinute())));
        openingWindow(locationId, date).ifPresent(windows::add);
        if (windows.isEmpty()) {
            return Optional.empty();
        }
        int open = windows.stream().mapToInt(OpeningWindow::openMinute).min().getAsInt();
        int close = windows.stream().mapToInt(OpeningWindow::closeMinute).max().getAsInt();
        return Optional.of(new OpeningWindow(open, close));
    }

    /** Sân → các phút bắt đầu đã có booking_slot đang hiệu lực (đang giữ chỗ hoặc đã đặt). */
    @Transactional(readOnly = true)
    public Map<Long, Set<Integer>> bookedStarts(Collection<Long> courtIds, LocalDate date) {
        Map<Long, Set<Integer>> result = new HashMap<>();
        if (courtIds.isEmpty()) return result;
        for (BookingSlot slot : bookingSlotRepository.findByCourtIdInAndSlotDateAndActiveTrue(courtIds, date)) {
            result.computeIfAbsent(slot.getCourtId(), k -> new HashSet<>()).add(slot.getSlotStartMinute());
        }
        return result;
    }

    /** Sân → các phút bắt đầu nằm trong lịch bảo trì đã được Owner duyệt (FR23–FR25). */
    @Transactional(readOnly = true)
    public Map<Long, Set<Integer>> maintenanceStarts(Collection<Long> courtIds, LocalDate date) {
        Map<Long, Set<Integer>> result = new HashMap<>();
        if (courtIds.isEmpty()) return result;
        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1);
        List<Maintenance> maintenances = maintenanceRepository
                .findByCourtIdInAndStatusAndStartAtLessThanAndEndAtGreaterThan(
                        courtIds, ApprovalStatus.APPROVED, dayEnd, dayStart);
        for (Maintenance m : maintenances) {
            // Bảo trì có thể kéo qua nhiều ngày: chỉ lấy phần nằm trong ngày đang xét.
            int from = m.getStartAt().isAfter(dayStart) ? toMinute(dayStart, m.getStartAt()) : 0;
            int to = m.getEndAt().isBefore(dayEnd) ? toMinute(dayStart, m.getEndAt()) : MinuteTime.DAY_MINUTES;
            Set<Integer> starts = result.computeIfAbsent(m.getCourtId(), k -> new HashSet<>());
            for (int s = from; s < to; s += MinuteTime.SLOT_MINUTES) {
                starts.add(s);
            }
        }
        return result;
    }

    /** Mọi slot của khoảng [startMinute, endMinute) trên một sân đều còn trống. */
    @Transactional(readOnly = true)
    public boolean isAvailable(Long locationId, Long courtId, LocalDate date, int startMinute, int endMinute) {
        Optional<OpeningWindow> window = openingWindow(locationId, date);
        if (window.isEmpty() || !window.get().covers(startMinute, endMinute)) {
            return false;
        }
        Set<Integer> booked = bookedStarts(List.of(courtId), date).getOrDefault(courtId, Set.of());
        Set<Integer> maintenance = maintenanceStarts(List.of(courtId), date).getOrDefault(courtId, Set.of());
        for (int s = startMinute; s < endMinute; s += MinuteTime.SLOT_MINUTES) {
            if (booked.contains(s) || maintenance.contains(s)) {
                return false;
            }
        }
        return true;
    }

    private static int toMinute(LocalDateTime dayStart, LocalDateTime time) {
        return (int) ChronoUnit.MINUTES.between(dayStart, time);
    }
}
