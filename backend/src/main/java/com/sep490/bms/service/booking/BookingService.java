package com.sep490.bms.service.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
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
import com.sep490.bms.service.team.TeamService;

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
    private final TeamService teamService;

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
        requireBookable(location, request.courtId(), request.date(), request.startMinute(), request.endMinute(), now);
        requireOwnTeam(player.getId(), request.teamId());
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
        requirePendingPaymentLimit(player.getId(), now);
        // Kiểm tra lại slot và tính lại giá niêm yết như màn tóm tắt: slot có thể vừa bị người khác giữ (FR39).
        // Voucher, điểm không kiểm tra ở bước này: lúc trừ sẽ kiểm tra lại dưới khóa dòng, lỗi báo MSG108.
        BookingSummaryResponse summary = previewSummary(player, withoutDiscounts(request), now);
        // Cột DATETIME2(0) chỉ lưu đến giây: bỏ phần lẻ để created_at và hold_expires_at cách nhau đúng 5 phút.
        LocalDateTime createdAt = now.truncatedTo(ChronoUnit.SECONDS);

        // Lưu với giá niêm yết; consumeForBooking, redeemForBooking tự ghi số giảm và finalAmount vào booking.
        Booking booking = bookingRepository.save(Booking.builder()
                .bookingCode(bookingCodeGenerator.next())
                .bookingType(BookingType.SINGLE)
                .locationId(summary.getLocationId())
                .courtId(summary.getCourtId())
                .playerId(player.getId())
                .teamId(request.teamId())
                .playDate(request.date())
                .startMinute(request.startMinute())
                .endMinute(request.endMinute())
                .note(StringUtils.hasText(request.note()) ? request.note().trim() : null)
                .listAmount(summary.getListAmount())
                .finalAmount(summary.getListAmount())
                .status(BookingStatus.HOLDING)
                .holdExpiresAt(createdAt.plusMinutes(HOLD_MINUTES))
                .createdAt(createdAt)
                .build());

        saveSlots(booking, summary.getSlots());
        // Voucher trước, điểm sau: trần điểm tính trên số tiền còn lại sau voucher (BR41).
        useVoucher(booking.getId(), request);
        usePoints(booking.getId(), request);
        return BookingResponse.from(booking);
    }

    /**
     * UC18: booking của chính Player đang đăng nhập. Booking của người khác trả 403 (NFR07),
     * kể cả booking tại quầy (không có player_id).
     */
    @Transactional(readOnly = true)
    public Booking getForPlayer(Long bookingId, Long playerId) {
        Booking booking = bookingRepository.findById(bookingId).orElseThrow(BookingService::bookingNotFound);
        requireBooker(booking, playerId);
        return booking;
    }

    /** Booking không phải của Player này thì 403. Dùng cả khi xem và khi khóa dòng để thanh toán. */
    public void requireBooker(Booking booking, Long playerId) {
        if (!playerId.equals(booking.getPlayerId())) {
            throw new AppException("Bạn không có quyền xem booking này", HttpStatus.FORBIDDEN);
        }
    }

    /**
     * UC18, UC19: đọc và khóa dòng booking đến hết giao dịch thanh toán. Request thứ hai cho cùng booking
     * (bấm Báo đã thanh toán hai lần) phải chờ, rồi thấy trạng thái đã đổi (FR56).
     * Không kiểm tra người đặt: Staff cũng dùng hàm này; phía Player tự gọi requireBooker.
     */
    public Booking lockForPayment(Long bookingId) {
        return bookingRepository.findByIdForUpdate(bookingId).orElseThrow(BookingService::bookingNotFound);
    }

    /** Đổi trạng thái booking theo bước thanh toán (UC18, UC19) và ghi ngay xuống database. */
    public Booking changeStatus(Booking booking, BookingStatus status) {
        booking.setStatus(status);
        booking.setUpdatedAt(LocalDateTime.now());
        return bookingRepository.saveAndFlush(booking);
    }

    /** UC19 #2: booking của một giao dịch, cho Staff xem. Quyền theo địa điểm do phía thanh toán kiểm tra. */
    @Transactional(readOnly = true)
    public Booking getById(Long bookingId) {
        return bookingRepository.findById(bookingId).orElseThrow(BookingService::bookingNotFound);
    }

    /** UC19 #1: đọc một lần các booking của một trang giao dịch chờ xác nhận, thay vì đọc từng dòng. */
    @Transactional(readOnly = true)
    public Map<Long, Booking> getByIds(Collection<Long> bookingIds) {
        return bookingRepository.findAllById(bookingIds).stream()
                .collect(Collectors.toMap(Booking::getId, Function.identity()));
    }

    /**
     * UC19 #2: tên và số điện thoại người đặt để Staff đối chiếu chuyển khoản (BR57).
     * Booking online lấy từ tài khoản Player; booking tại quầy lấy từ thông tin Staff đã nhập (BR43).
     */
    @Transactional(readOnly = true)
    public Customer getCustomer(Booking booking) {
        if (booking.getPlayerId() == null) {
            return new Customer(booking.getCustomerName(), booking.getCustomerPhone());
        }
        return accountRepository.findById(booking.getPlayerId())
                .map(account -> new Customer(account.getFullName(), account.getPhone()))
                .orElse(new Customer(null, null));
    }

    /** UC19 #2: tên sân của booking. */
    @Transactional(readOnly = true)
    public String getCourtName(Booking booking) {
        return courtRepository.findById(booking.getCourtId()).map(Court::getName).orElse(null);
    }

    /**
     * UC19 #5, BR34: nhả các slot của booking bị từ chối thanh toán để người khác đặt được.
     * Phải chạy trong giao dịch của bên gọi, sau khi booking đã đổi trạng thái.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public int releaseSlots(Long bookingId) {
        return bookingSlotRepository.deactivateByBookingId(bookingId);
    }

    /** Người đặt của một booking, để hiện cho Staff. */
    public record Customer(String name, String phone) {
    }

    private static AppException bookingNotFound() {
        return new AppException("Không tìm thấy booking", HttpStatus.NOT_FOUND);
    }

    /**
     * Mỗi slot 30 phút một dòng, kèm giá niêm yết lúc đặt (D88).
     * Hai người cùng qua bước kiểm tra lại rồi cùng ghi: unique ux_slot_active chặn người sau (NFR04).
     * Lỗi đó đổi thành MSG28 như khi bước kiểm tra lại phát hiện; cả giao dịch hủy nên booking vừa lưu cũng mất.
     * Dùng chung cho booking lẻ (UC14) và booking tại quầy (UC16); chạy trong giao dịch của bên gọi.
     */
    public void saveSlots(Booking booking, List<SlotPrice> slots) {
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

    /** UC14 #4, FR74: trừ lượt và ngân sách voucher khi tạo booking. VoucherService kiểm tra lại dưới khóa dòng. */
    private void useVoucher(Long bookingId, BookingRequest request) {
        VoucherSelection selection = voucherSelection(request);
        if (selection == null) {
            return;
        }
        try {
            voucherService.consumeForBooking(bookingId, selection);
        } catch (AppException e) {
            throw noLongerUsable("Mã giảm giá", e);
        }
    }

    /** UC14 #5, FR75: trừ điểm khi tạo booking. LoyaltyPointService kiểm tra lại số dư và trần 50% (BR41). */
    private void usePoints(Long bookingId, BookingRequest request) {
        Integer points = request.pointsToUse();
        if (points == null || points == 0) {
            return;
        }
        try {
            loyaltyPointService.redeemForBooking(bookingId, points);
        } catch (AppException e) {
            throw noLongerUsable("Số điểm", e);
        }
    }

    /**
     * Voucher hoặc điểm đã áp ở màn tóm tắt nhưng lúc bấm Xác nhận không còn dùng được: MSG108 kèm lý do.
     * Lỗi không phải 400 (ví dụ 409 dữ liệu không nhất quán) giữ nguyên.
     */
    static AppException noLongerUsable(String what, AppException e) {
        if (e.getStatus() != HttpStatus.BAD_REQUEST) {
            return e;
        }
        // Bỏ mã MSG và dấu chấm cuối trong câu gốc để câu MSG108 không bị lặp mã, lặp dấu chấm.
        String reason = e.getMessage()
                .replaceFirst("^MSG\\d+:\\s*", "")
                .replaceFirst("\\s*\\(MSG\\d+\\)\\s*$", "")
                .replaceFirst("[.\\s]+$", "");
        return new AppException(what + " không còn dùng được: " + reason + ". Vui lòng kiểm tra lại. (MSG108)");
    }

    /** Request chỉ còn sân, ngày, giờ, ghi chú, đội: dùng để kiểm tra lại slot, đội và tính giá niêm yết lúc Xác nhận. */
    private static BookingRequest withoutDiscounts(BookingRequest request) {
        return new BookingRequest(request.courtId(), request.date(), request.startMinute(), request.endMinute(),
                null, null, null, request.note(), request.teamId());
    }

    /**
     * UC14 #1, UC15 #1, FR37, BR09, DR03: không chọn đội là booking cá nhân; chọn đội thì đội đó phải do người đặt làm chủ.
     * Kiểm tra cả ở màn tóm tắt và lúc Xác nhận (createSingleBooking gọi lại previewSummary).
     */
    public void requireOwnTeam(Long playerId, Long teamId) {
        if (teamId != null && !teamService.isCaptain(teamId, playerId)) {
            throw new AppException("Bạn chỉ đặt sân được cho đội mình làm chủ.", HttpStatus.FORBIDDEN);
        }
    }

    /**
     * BR35: đã có 2 booking đang chờ thanh toán (booking lẻ + gói, mỗi gói tính một) thì không tạo thêm (MSG29).
     * Khóa dòng account của Player trước khi đếm: hai request của cùng Player gửi cùng lúc phải chạy lần lượt,
     * nếu không cả hai cùng đếm được 1 rồi cùng tạo, thành 3 booking chờ.
     */
    public void requirePendingPaymentLimit(Long playerId, LocalDateTime now) {
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
     * Dùng chung cho booking lẻ (UC14) và booking tại quầy (UC16: cùng giới hạn đặt trước BR02, BR43).
     */
    public void requireBookable(Location location, Long courtId, LocalDate date, int startMinute, int endMinute,
            LocalDateTime now) {
        int advanceDays = location.getAdvanceBookingDays();
        LocalDate today = now.toLocalDate();
        boolean started = date.isBefore(today)
                || (date.equals(today) && startMinute <= now.getHour() * 60 + now.getMinute());
        if (started || date.isAfter(today.plusDays(advanceDays))) {
            throw notBookable(advanceDays);
        }
        SlotProblem problem = slotAvailabilityService.findProblem(location.getId(), courtId, date,
                startMinute, endMinute).orElse(null);
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

    /** Giá từng slot 30 phút theo thứ tự giờ: để hiện ở màn tóm tắt và để lưu vào booking_slot. */
    public static List<SlotPrice> toSlots(Map<Integer, BigDecimal> prices) {
        return prices.entrySet().stream()
                .map(e -> SlotPrice.builder()
                        .startMinute(e.getKey())
                        .time(MinuteTime.format(e.getKey()))
                        .price(e.getValue())
                        .build())
                .toList();
    }
}
