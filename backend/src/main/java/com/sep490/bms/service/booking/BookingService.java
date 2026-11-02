package com.sep490.bms.service.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.dto.booking.BookingResponse;
import com.sep490.bms.dto.booking.BookingSummaryResponse;
import com.sep490.bms.dto.booking.BookingSummaryResponse.SlotPrice;
import com.sep490.bms.dto.promotion.VoucherCheckRequest;
import com.sep490.bms.dto.promotion.VoucherSelection;
import com.sep490.bms.dto.request.BookingRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.booking.BookingSlot;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.BookingType;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.booking.BookingPackageRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.booking.BookingSlotRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.SlotAvailabilityService.SlotProblem;
import com.sep490.bms.service.location.LocationQueryService;
import com.sep490.bms.service.promotion.LoyaltyPointService;
import com.sep490.bms.service.promotion.VoucherService;

import lombok.RequiredArgsConstructor;

/**
 * Đặt sân lẻ (UC14). Một booking là các slot liền nhau trên một sân (BR01):
 * BookingRequest chỉ có một sân và một khoảng giờ nên không thể gửi slot rời.
 */
@Service
@RequiredArgsConstructor
public class BookingService {

    /** Thời gian giữ chỗ (BR03, P02): cố định, Owner không cài (D154). */
    static final int HOLD_MINUTES = 5;
    /** Số booking đang chờ thanh toán tối đa của một Player (BR35, P08): cố định (D154). */
    static final int MAX_PENDING_PAYMENTS = 2;
    /** Unique có điều kiện trên booking_slot (court_id, slot_date, slot_start_minute) WHERE is_active = 1. */
    static final String SLOT_UNIQUE_INDEX = "ux_slot_active";

    private final CourtRepository courtRepository;
    private final LocationQueryService locationQueryService;
    private final SlotAvailabilityService slotAvailabilityService;
    private final PriceCalculator priceCalculator;
    private final VoucherService voucherService;
    private final LoyaltyPointService loyaltyPointService;
    private final AccountRepository accountRepository;
    private final BookingRepository bookingRepository;
    private final BookingSlotRepository bookingSlotRepository;
    private final BookingCodeGenerator bookingCodeGenerator;
    private final BookingPackageRepository bookingPackageRepository;

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
        BigDecimal voucherDiscount = voucherDiscount(player, location.getId(), listAmount, request);
        BigDecimal afterVoucher = listAmount.subtract(voucherDiscount);
        BigDecimal pointDiscount = pointDiscount(player, location.getId(), afterVoucher, request);

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
                .voucherDiscount(voucherDiscount)
                .pointDiscount(pointDiscount)
                .finalAmount(afterVoucher.subtract(pointDiscount))
                .build();
    }

    /**
     * UC14 #6–8: Player bấm Xác nhận ở màn tóm tắt. Tạo booking Đang giữ chỗ, lưu từng slot 30 phút,
     * giữ chỗ 5 phút tính từ lúc bấm (D128, BR03). Tất cả trong một giao dịch: lỗi ở bước nào thì không lưu gì.
     */
    @Transactional
    public BookingResponse createSingleBooking(UserPrincipal player, BookingRequest request) {
        return createSingleBooking(player, request, LocalDateTime.now());
    }

    BookingResponse createSingleBooking(UserPrincipal player, BookingRequest request, LocalDateTime now) {
        // Tạm thời ở 5.1: chưa trừ voucher, điểm (làm ở 5.4). Chặn lại để không lưu booking có giảm giá
        // mà lượt voucher, số điểm chưa bị trừ. Bỏ đoạn này ở 5.4.
        if (voucherSelection(request) != null || (request.pointsToUse() != null && request.pointsToUse() > 0)) {
            throw new AppException("Chưa hỗ trợ dùng voucher hoặc điểm khi tạo booking", HttpStatus.NOT_IMPLEMENTED);
        }
        requirePendingPaymentLimit(player.getId(), now);
        // Chạy lại toàn bộ kiểm tra và cách tính của màn tóm tắt: slot có thể vừa bị người khác giữ (FR39).
        BookingSummaryResponse summary = previewSummary(player, request, now);
        // Cột DATETIME2(0) chỉ lưu đến giây: bỏ phần lẻ để created_at và hold_expires_at cách nhau đúng 5 phút.
        LocalDateTime createdAt = now.truncatedTo(ChronoUnit.SECONDS);

        Booking booking = bookingRepository.save(Booking.builder()
                .bookingCode(bookingCodeGenerator.next())
                .bookingType(BookingType.SINGLE)
                .locationId(summary.getLocationId())
                .courtId(summary.getCourtId())
                .playerId(player.getId())
                .playDate(request.date())
                .startMinute(request.startMinute())
                .endMinute(request.endMinute())
                .note(StringUtils.hasText(request.note()) ? request.note().trim() : null)
                .listAmount(summary.getListAmount())
                .voucherDiscount(summary.getVoucherDiscount())
                .pointDiscount(summary.getPointDiscount())
                .finalAmount(summary.getFinalAmount())
                .status(BookingStatus.HOLDING)
                .holdExpiresAt(createdAt.plusMinutes(HOLD_MINUTES))
                .createdAt(createdAt)
                .build());

        saveSlots(booking, summary.getSlots());
        return BookingResponse.from(booking);
    }

    /**
     * Mỗi slot 30 phút một dòng, kèm giá niêm yết lúc đặt (D88).
     * Hai người cùng qua bước kiểm tra lại rồi cùng ghi: unique ux_slot_active chặn người sau (NFR04).
     * Lỗi đó đổi thành MSG28 như khi bước kiểm tra lại phát hiện; cả giao dịch hủy nên booking vừa lưu cũng mất.
     */
    private void saveSlots(Booking booking, List<SlotPrice> slots) {
        try {
            bookingSlotRepository.saveAllAndFlush(slots.stream()
                    .map(slot -> BookingSlot.builder()
                            .bookingId(booking.getId())
                            .courtId(booking.getCourtId())
                            .slotDate(booking.getPlayDate())
                            .slotStartMinute(slot.getStartMinute())
                            .price(slot.getPrice())
                            .build())
                    .toList());
        } catch (DataIntegrityViolationException e) {
            String cause = e.getMostSpecificCause().getMessage();
            if (cause == null || !cause.contains(SLOT_UNIQUE_INDEX)) {
                throw e;
            }
            throw slotTaken();
        }
    }

    /**
     * BR35: đã có 2 booking đang chờ thanh toán (booking lẻ + gói, mỗi gói tính một) thì không tạo thêm (MSG29).
     * Khóa dòng account của Player trước khi đếm: hai request của cùng Player gửi cùng lúc phải chạy lần lượt,
     * nếu không cả hai cùng đếm được 1 rồi cùng tạo, thành 3 booking chờ.
     */
    private void requirePendingPaymentLimit(Long playerId, LocalDateTime now) {
        accountRepository.findByIdForUpdate(playerId)
                .orElseThrow(() -> new AppException("Không tìm thấy tài khoản", HttpStatus.NOT_FOUND));
        long pending = bookingRepository.countPendingPayment(playerId, now)
                + bookingPackageRepository.countPendingPayment(playerId, now);
        if (pending >= MAX_PENDING_PAYMENTS) {
            throw new AppException("Bạn đang có " + pending
                    + " booking chờ thanh toán. Vui lòng hoàn tất các booking đó trước khi đặt thêm. (MSG29)",
                    HttpStatus.CONFLICT);
        }
    }

    /**
     * UC14 #4: chỉ kiểm tra và tính số giảm, chưa trừ lượt (FR74). Lượt bị trừ khi tạo booking.
     * Không chọn voucher thì giảm 0; voucher không dùng được thì báo MSG34 kèm lý do.
     */
    private BigDecimal voucherDiscount(UserPrincipal player, Long locationId, BigDecimal listAmount,
            BookingRequest request) {
        VoucherSelection selection = voucherSelection(request);
        if (selection == null) {
            return BigDecimal.ZERO;
        }
        try {
            return voucherService.check(player, new VoucherCheckRequest(locationId, listAmount, selection))
                    .discountAmount();
        } catch (AppException e) {
            if (e.getStatus() != HttpStatus.BAD_REQUEST) {
                throw e;
            }
            throw new AppException("Mã giảm giá không dùng được: " + e.getMessage() + " (MSG34)");
        }
    }

    /**
     * UC14 #5: chỉ kiểm tra và tính số giảm, chưa trừ điểm (FR75). Điểm bị trừ khi tạo booking.
     * Tính sau voucher vì trần 50% lấy trên số tiền còn lại sau voucher (BR41).
     */
    private BigDecimal pointDiscount(UserPrincipal player, Long locationId, BigDecimal afterVoucher,
            BookingRequest request) {
        Integer points = request.pointsToUse();
        if (points == null || points == 0) {
            return BigDecimal.ZERO;
        }
        return loyaltyPointService.preview(player.getId(), locationId, afterVoucher, points);
    }

    /** Voucher công khai chọn bằng mã, voucher được tặng chọn bằng grantId; cả hai đều trống là không dùng voucher. */
    private static VoucherSelection voucherSelection(BookingRequest request) {
        if (request.voucherGrantId() != null) {
            return new VoucherSelection(null, request.voucherGrantId());
        }
        return StringUtils.hasText(request.voucherCode()) ? new VoucherSelection(request.voucherCode(), null) : null;
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
            throw slotTaken();
        }
        if (problem != null) {
            throw notBookable(advanceDays);
        }
    }

    private static AppException slotTaken() {
        return new AppException("Slot vừa có người giữ hoặc đặt. Vui lòng chọn slot khác. (MSG28)",
                HttpStatus.CONFLICT);
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
