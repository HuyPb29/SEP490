package com.sep490.bms.service.booking;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.dto.booking.WalkInBookingItem;
import com.sep490.bms.dto.booking.WalkInBookingRequest;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.BookingType;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.LocationQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Đặt sân tại quầy (UC16, BR43): Staff tạo booking cho khách liên hệ trực tiếp với sân, nhập tên và số điện
 * thoại khách; không có đội, voucher, điểm. Slot được giữ 5 phút như booking online (BR03); Staff thấy tiền
 * đã về (BR33) thì xác nhận. Staff chỉ làm việc ở địa điểm của mình (NFR07, BR60).
 */
@Service
@RequiredArgsConstructor
public class WalkInBookingService {

    private final LocationAccessService locationAccessService;
    private final LocationQueryService locationQueryService;
    private final CourtRepository courtRepository;
    private final PriceCalculator priceCalculator;
    private final BookingService bookingService;
    private final BookingRepository bookingRepository;
    private final BookingCodeGenerator bookingCodeGenerator;

    /**
     * UC16 #1–2, FR47, FR48: kiểm tra slot như đặt sân lẻ (giới hạn đặt trước BR02, giờ mở cửa, bảo trì,
     * trùng lịch), rồi tạo booking Đang giữ chỗ và lưu từng slot 30 phút. Giữ chỗ 5 phút tính từ lúc tạo.
     * Không đếm BR35: giới hạn đó chỉ áp cho Player.
     */
    @Transactional
    public WalkInBookingItem create(UserPrincipal staff, WalkInBookingRequest request) {
        return create(staff, request, LocalDateTime.now());
    }

    WalkInBookingItem create(UserPrincipal staff, WalkInBookingRequest request, LocalDateTime now) {
        Location location = locationQueryService.findActive(locationAccessService.selectedLocation(staff).getId());
        Court court = courtRepository.findByIdAndActiveTrue(request.courtId())
                .orElseThrow(() -> new AppException("Không tìm thấy sân", HttpStatus.NOT_FOUND));
        if (!location.getId().equals(court.getLocationId())) {
            throw new AppException("Sân không thuộc địa điểm của bạn", HttpStatus.FORBIDDEN);
        }
        bookingService.requireBookable(location, court.getId(), request.date(),
                request.startMinute(), request.endMinute(), now);

        Map<Integer, BigDecimal> prices = priceCalculator.rangePrices(
                court.getId(), request.date(), request.startMinute(), request.endMinute());
        BigDecimal amount = prices.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        // Cột DATETIME2(0) chỉ lưu đến giây: bỏ phần lẻ để created_at và hold_expires_at cách nhau đúng 5 phút.
        LocalDateTime createdAt = now.truncatedTo(ChronoUnit.SECONDS);

        // Không có ưu đãi nên số phải trả = giá niêm yết (BR43). Database chặn thêm bằng ck_booking_walkin.
        Booking booking = bookingRepository.save(Booking.builder()
                .bookingCode(bookingCodeGenerator.next())
                .bookingType(BookingType.WALK_IN)
                .locationId(location.getId())
                .courtId(court.getId())
                .staffId(staff.getId())
                .customerName(request.customerName())
                .customerPhone(request.customerPhone())
                .playDate(request.date())
                .startMinute(request.startMinute())
                .endMinute(request.endMinute())
                .listAmount(amount)
                .finalAmount(amount)
                .status(BookingStatus.HOLDING)
                .holdExpiresAt(createdAt.plusMinutes(BookingService.HOLD_MINUTES))
                .createdAt(createdAt)
                .build());
        bookingService.saveSlots(booking, BookingService.toSlots(prices));
        return toItem(booking, court.getName(), now);
    }

    /** Đang giữ chỗ đã quá hạn hiện là Hết hạn (BR03), như phía Player (UC17). */
    static WalkInBookingItem toItem(Booking booking, String courtName, LocalDateTime now) {
        BookingStatus status = BookingQueryService.shownStatus(booking.getStatus(), booking.getHoldExpiresAt(), now);
        return WalkInBookingItem.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .courtId(booking.getCourtId())
                .courtName(courtName)
                .playDate(booking.getPlayDate())
                .startTime(MinuteTime.format(booking.getStartMinute()))
                .endTime(MinuteTime.format(booking.getEndMinute()))
                .customerName(booking.getCustomerName())
                .customerPhone(booking.getCustomerPhone())
                .finalAmount(booking.getFinalAmount())
                .status(status)
                .holdExpiresAt(status == BookingStatus.HOLDING ? booking.getHoldExpiresAt() : null)
                .createdAt(booking.getCreatedAt())
                .build();
    }
}
