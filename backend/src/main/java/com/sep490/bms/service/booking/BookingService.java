package com.sep490.bms.service.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.dto.booking.BookingSummaryResponse;
import com.sep490.bms.dto.booking.BookingSummaryResponse.SlotPrice;
import com.sep490.bms.dto.request.BookingRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.SlotAvailabilityService.SlotProblem;
import com.sep490.bms.service.location.LocationQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Đặt sân lẻ (UC14). Một booking là các slot liền nhau trên một sân (BR01):
 * BookingRequest chỉ có một sân và một khoảng giờ nên không thể gửi slot rời.
 */
@Service
@RequiredArgsConstructor
public class BookingService {

    private final CourtRepository courtRepository;
    private final LocationQueryService locationQueryService;
    private final SlotAvailabilityService slotAvailabilityService;
    private final PriceCalculator priceCalculator;
    private final AccountRepository accountRepository;

    /** UC14 #1–5: tính màn tóm tắt để Player xem lại trước khi bấm Xác nhận. Không tạo booking, không giữ chỗ (D128). */
    @Transactional(readOnly = true)
    public BookingSummaryResponse previewSummary(UserPrincipal player, BookingRequest request) {
        return previewSummary(player, request, LocalDateTime.now());
    }

    /** Tách tham số now để test được theo giờ cố định. */
    BookingSummaryResponse previewSummary(UserPrincipal player, BookingRequest request, LocalDateTime now) {
        Court court = courtRepository.findByIdAndActiveTrue(request.courtId())
                .orElseThrow(() -> new AppException("Không tìm thấy sân", HttpStatus.NOT_FOUND));
        Location location = locationQueryService.findActive(court.getLocationId());
        requireBookable(location, request, now);
        Account booker = accountRepository.findById(player.getId())
                .orElseThrow(() -> new AppException("Không tìm thấy tài khoản", HttpStatus.NOT_FOUND));

        Map<Integer, BigDecimal> prices = priceCalculator.rangePrices(
                court.getId(), request.date(), request.startMinute(), request.endMinute());
        BigDecimal listAmount = prices.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        return BookingSummaryResponse.builder()
                .locationId(location.getId())
                .locationName(location.getName())
                .courtId(court.getId())
                .courtName(court.getName())
                .date(request.date())
                .startTime(MinuteTime.format(request.startMinute()))
                .endTime(MinuteTime.format(request.endMinute()))
                .bookerName(booker.getFullName())
                .bookerPhone(booker.getPhone())
                .slots(toSlots(prices))
                .listAmount(listAmount)
                .voucherDiscount(BigDecimal.ZERO)
                .pointDiscount(BigDecimal.ZERO)
                .finalAmount(listAmount)
                .build();
    }

    /**
     * Slot đã bắt đầu, quá hạn đặt trước (BR02), ngoài giờ mở cửa hoặc bảo trì: MSG31.
     * Slot đã có người giữ hoặc đặt, kể cả chính Player đang giữ (D132): MSG28.
     */
    private void requireBookable(Location location, BookingRequest request, LocalDateTime now) {
        int advanceDays = location.getAdvanceBookingDays();
        LocalDate today = now.toLocalDate();
        LocalDate date = request.date();
        boolean started = date.isBefore(today)
                || (date.equals(today) && request.startMinute() <= now.getHour() * 60 + now.getMinute());
        if (started || date.isAfter(today.plusDays(advanceDays))) {
            throw notBookable(advanceDays);
        }
        SlotProblem problem = slotAvailabilityService.findProblem(location.getId(), request.courtId(), date,
                request.startMinute(), request.endMinute()).orElse(null);
        if (problem == SlotProblem.TAKEN) {
            throw new AppException("Slot vừa có người giữ hoặc đặt. Vui lòng chọn slot khác. (MSG28)",
                    HttpStatus.CONFLICT);
        }
        if (problem != null) {
            throw notBookable(advanceDays);
        }
    }

    private static AppException notBookable(int advanceDays) {
        return new AppException(
                "Chỉ đặt được slot trống, trong giờ mở cửa và trước tối đa " + advanceDays + " ngày. (MSG31)");
    }

    private static List<SlotPrice> toSlots(Map<Integer, BigDecimal> prices) {
        return prices.entrySet().stream()
                .map(e -> SlotPrice.builder()
                        .startMinute(e.getKey())
                        .time(MinuteTime.format(e.getKey()))
                        .price(e.getValue())
                        .build())
                .toList();
    }
}
