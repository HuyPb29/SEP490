package com.sep490.bms.service.booking;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.booking.BookingDetailResponse;
import com.sep490.bms.dto.booking.BookingListItem;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.LocationQueryService;
import com.sep490.bms.service.payment.PaymentService;

import lombok.RequiredArgsConstructor;

/**
 * Xem lịch sử booking (UC17): Player chỉ xem booking của chính mình (NFR07). Chỉ đọc, không thay đổi gì.
 */
@Service
@RequiredArgsConstructor
public class BookingQueryService {

    private static final int MAX_PAGE_SIZE = 100;

    private final BookingRepository bookingRepository;
    private final CourtRepository courtRepository;
    private final LocationQueryService locationQueryService;
    private final BookingService bookingService;
    private final PaymentService paymentService;

    /**
     * UC17 #1–2, FR51: booking lẻ của Player kèm trạng thái hiện tại, gồm cả booking đã hết hạn, bị từ chối
     * thanh toán, đã hủy. Booking đang chờ thanh toán xếp đầu (BR35). status = null: không lọc.
     */
    @Transactional(readOnly = true)
    public PageResponse<BookingListItem> listMyBookings(UserPrincipal player, BookingStatus status, int page, int size) {
        return listMyBookings(player, status, page, size, LocalDateTime.now());
    }

    PageResponse<BookingListItem> listMyBookings(UserPrincipal player, BookingStatus status, int page, int size,
            LocalDateTime now) {
        requireValidPage(page, size);
        Page<Booking> result = bookingRepository.findPlayerBookings(player.getId(), status, now,
                PageRequest.of(page, size));
        Map<Long, Location> locations = locationQueryService.getByIds(result.map(Booking::getLocationId).toSet());
        Map<Long, Court> courts = courtRepository.findAllById(result.map(Booking::getCourtId).toSet()).stream()
                .collect(Collectors.toMap(Court::getId, Function.identity()));
        return PageResponse.from(result.map(booking -> toListItem(booking, locations.get(booking.getLocationId()),
                courts.get(booking.getCourtId()), now)));
    }

    /**
     * UC17 #3–5, FR35, FR51, FR52: chi tiết một booking của Player, kèm trạng thái thanh toán và paymentId
     * cho nút Gửi lại chứng từ. Booking của người khác (kể cả booking tại quầy) trả 403 (NFR07).
     */
    @Transactional(readOnly = true)
    public BookingDetailResponse getMyBooking(UserPrincipal player, Long bookingId) {
        return getMyBooking(player, bookingId, LocalDateTime.now());
    }

    BookingDetailResponse getMyBooking(UserPrincipal player, Long bookingId, LocalDateTime now) {
        Booking booking = bookingService.getForPlayer(bookingId, player.getId());
        Location location = locationQueryService.getByIds(List.of(booking.getLocationId())).get(booking.getLocationId());
        Optional<Payment> payment = paymentService.findForBooking(booking.getId());
        BookingStatus status = shownStatus(booking.getStatus(), booking.getHoldExpiresAt(), now);

        return BookingDetailResponse.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .bookingType(booking.getBookingType())
                .packageId(booking.getPackageId())
                .teamId(booking.getTeamId())
                .locationId(booking.getLocationId())
                .locationName(location == null ? null : location.getName())
                .locationAddress(location == null ? null : location.getAddress())
                .courtName(bookingService.getCourtName(booking))
                .playDate(booking.getPlayDate())
                .startTime(MinuteTime.format(booking.getStartMinute()))
                .endTime(MinuteTime.format(booking.getEndMinute()))
                .note(booking.getNote())
                .listAmount(booking.getListAmount())
                .voucherDiscount(booking.getVoucherDiscount())
                .pointsUsed(booking.getPointsUsed())
                .pointDiscount(booking.getPointDiscount())
                .finalAmount(booking.getFinalAmount())
                .status(status)
                .holdExpiresAt(status == BookingStatus.HOLDING ? booking.getHoldExpiresAt() : null)
                .createdAt(booking.getCreatedAt())
                .cancelledAt(booking.getCancelledAt())
                .paymentId(payment.map(Payment::getId).orElse(null))
                .paymentStatus(payment.map(Payment::getStatus).orElse(null))
                .resubmitReason(payment.map(Payment::getResubmitReason).orElse(null))
                .resubmitDeadline(payment.map(Payment::getResubmitDeadline).orElse(null))
                .receiptNo(payment.map(Payment::getReceiptNo).orElse(null))
                .build();
    }

    // ---------------------------------------------------------------- Hỗ trợ

    /**
     * Trạng thái hiện cho Player. Đang giữ chỗ mà đã quá hạn thì hiện Hết hạn, vì Player không còn thanh toán
     * được (BR03), dù job UC37 chưa kịp đổi trạng thái trong database.
     */
    static BookingStatus shownStatus(BookingStatus status, LocalDateTime holdExpiresAt, LocalDateTime now) {
        if (status == BookingStatus.HOLDING && holdExpiresAt != null && !holdExpiresAt.isAfter(now)) {
            return BookingStatus.EXPIRED;
        }
        return status;
    }

    private static BookingListItem toListItem(Booking booking, Location location, Court court, LocalDateTime now) {
        BookingStatus status = shownStatus(booking.getStatus(), booking.getHoldExpiresAt(), now);
        return BookingListItem.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .locationId(booking.getLocationId())
                .locationName(location == null ? null : location.getName())
                .courtName(court == null ? null : court.getName())
                .playDate(booking.getPlayDate())
                .startTime(MinuteTime.format(booking.getStartMinute()))
                .endTime(MinuteTime.format(booking.getEndMinute()))
                .finalAmount(booking.getFinalAmount())
                .status(status)
                .holdExpiresAt(status == BookingStatus.HOLDING ? booking.getHoldExpiresAt() : null)
                .createdAt(booking.getCreatedAt())
                .build();
    }

    private static void requireValidPage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new AppException("Phân trang không hợp lệ");
        }
    }
}
