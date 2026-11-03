package com.sep490.bms.service.payment;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import org.springframework.core.io.Resource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.sep490.bms.dto.payment.PaymentInstructionResponse;
import com.sep490.bms.dto.payment.PaymentResponse;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.payment.Payment;
import com.sep490.bms.entity.payment.PaymentProof;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.payment.PaymentProofRepository;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.booking.BookingService;
import com.sep490.bms.service.integration.FileStorageService;
import com.sep490.bms.service.location.LocationQueryService;

import lombok.RequiredArgsConstructor;

/**
 * Thanh toán booking lẻ (UC18). Hệ thống không nối ngân hàng: Player tự chuyển khoản theo thông tin
 * của địa điểm rồi báo kèm ảnh chứng từ; Staff đối chiếu tiền thực về (BR33, UC19).
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

    /** Thư mục con chứa ảnh chứng từ trong thư mục lưu ảnh (A03). */
    static final String PROOF_FOLDER = "payment-proofs";
    /** Unique có điều kiện: mỗi booking chỉ có một dòng payment (FR56). */
    static final String PAYMENT_BOOKING_UNIQUE_INDEX = "ux_payment_booking";

    private final PaymentRepository paymentRepository;
    private final PaymentProofRepository paymentProofRepository;
    private final BookingService bookingService;
    private final LocationQueryService locationQueryService;
    private final FileStorageService fileStorageService;

    /** UC18 #1, FR55: số tiền, tài khoản nhận, mã QR và giờ hết giữ chỗ. Không thay đổi gì. */
    @Transactional(readOnly = true)
    public PaymentInstructionResponse getInstructions(UserPrincipal player, Long bookingId) {
        return getInstructions(player, bookingId, LocalDateTime.now());
    }

    PaymentInstructionResponse getInstructions(UserPrincipal player, Long bookingId, LocalDateTime now) {
        Booking booking = bookingService.getForPlayer(bookingId, player.getId());
        requireWaitingForTransfer(booking, now);
        Location location = locationQueryService.findActive(booking.getLocationId());
        boolean holding = booking.getStatus() == BookingStatus.HOLDING;

        return PaymentInstructionResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus())
                .amountDue(booking.getFinalAmount())
                .bankName(location.getBankName())
                .bankAccountNo(location.getBankAccountNo())
                .bankAccountHolder(location.getBankAccountHolder())
                .qrImageUrl(location.getQrImagePath() == null ? null
                        : "/api/bookings/" + booking.getId() + "/payment-instructions/qr")
                .holdExpiresAt(holding ? booking.getHoldExpiresAt() : null)
                .build();
    }

    /**
     * UC18 #1, FR55: ảnh mã QR của địa điểm, để hiện và để Player lưu về máy.
     * Ảnh không nằm ở thư mục công khai; chỉ người đặt booking đang chờ chuyển khoản mới lấy được (A03).
     */
    @Transactional(readOnly = true)
    public Resource loadQrImage(UserPrincipal player, Long bookingId) {
        return loadQrImage(player, bookingId, LocalDateTime.now());
    }

    Resource loadQrImage(UserPrincipal player, Long bookingId, LocalDateTime now) {
        Booking booking = bookingService.getForPlayer(bookingId, player.getId());
        requireWaitingForTransfer(booking, now);
        String path = locationQueryService.findActive(booking.getLocationId()).getQrImagePath();
        if (path == null) {
            throw new AppException("Địa điểm chưa có ảnh mã QR", HttpStatus.NOT_FOUND);
        }
        return fileStorageService.load(path);
    }

    /**
     * UC18 #2–3, FR55, FR56: Player đính kèm ảnh chứng từ rồi bấm Báo đã thanh toán. Tạo payment Chờ xác nhận
     * và dòng payment_proof đầu tiên; booking sang Chờ xác nhận, slot giữ đến khi Staff xử lý xong (BR03).
     */
    @Transactional
    public PaymentResponse submitProof(UserPrincipal player, Long bookingId, MultipartFile proof) {
        return submitProof(player, bookingId, proof, LocalDateTime.now());
    }

    PaymentResponse submitProof(UserPrincipal player, Long bookingId, MultipartFile proof, LocalDateTime now) {
        requireProofAttached(proof);
        // Khóa dòng booking: bấm hai lần thì request sau chờ request trước xong, rồi thấy booking đã Chờ xác nhận.
        Booking booking = bookingService.lockForPayment(bookingId);
        bookingService.requireBooker(booking, player.getId());
        requireNotReportedYet(booking, now);

        // Lưu ảnh sau khi kiểm tra xong, để request bị từ chối không để lại file.
        String imagePath = fileStorageService.storeImage(proof, PROOF_FOLDER);
        LocalDateTime submittedAt = now.truncatedTo(ChronoUnit.SECONDS);
        Payment payment = insertPayment(Payment.builder()
                .locationId(booking.getLocationId())
                .bookingId(booking.getId())
                .amountDue(booking.getFinalAmount())
                .status(PaymentStatus.AWAITING_CONFIRMATION)
                .submittedAt(submittedAt)
                .build());
        paymentProofRepository.save(PaymentProof.builder()
                .paymentId(payment.getId())
                .imagePath(imagePath)
                .uploadedAt(submittedAt)
                .build());
        bookingService.changeStatus(booking, BookingStatus.AWAITING_CONFIRMATION);
        return PaymentResponse.from(payment, booking);
    }

    /**
     * Khóa dòng booking đã chặn việc ghi hai lần; unique ux_payment_booking là chốt cuối (FR56).
     * Lỗi trùng đó báo như khi booking đã được báo thanh toán.
     */
    private Payment insertPayment(Payment payment) {
        try {
            return paymentRepository.saveAndFlush(payment);
        } catch (DataIntegrityViolationException e) {
            String cause = e.getMostSpecificCause().getMessage();
            if (cause == null || !cause.contains(PAYMENT_BOOKING_UNIQUE_INDEX)) {
                throw e;
            }
            throw alreadyReported();
        }
    }

    /** DR21, MSG106: báo đã thanh toán hay gửi lại đều phải có ảnh chứng từ. Định dạng, dung lượng do FileStorageService kiểm tra. */
    private static void requireProofAttached(MultipartFile proof) {
        if (proof == null || proof.isEmpty()) {
            throw new AppException("Vui lòng đính kèm ảnh chứng từ chuyển khoản. (MSG106)");
        }
    }

    /**
     * Báo đã thanh toán lần đầu: booking lẻ phải đang giữ chỗ và còn hạn.
     * Đã báo rồi (bấm lại, mở hai tab) thì 409; muốn gửi ảnh khác phải chờ Staff yêu cầu bổ sung (FR54).
     */
    private static void requireNotReportedYet(Booking booking, LocalDateTime now) {
        if (booking.getPackageId() != null) {
            throw notWaitingForPayment();
        }
        switch (booking.getStatus()) {
            case HOLDING -> requireHoldNotExpired(booking, now);
            case EXPIRED -> throw holdExpired();
            case AWAITING_CONFIRMATION, RESUBMIT_REQUESTED, CONFIRMED -> throw alreadyReported();
            default -> throw notWaitingForPayment();
        }
    }

    /**
     * Chỉ booking lẻ đang chờ Player chuyển khoản mới xem được thông tin thanh toán:
     * đang giữ chỗ và còn hạn (lần đầu), hoặc chờ bổ sung (chuyển thêm, gửi lại chứng từ).
     * Buổi trong gói thanh toán theo gói (UC15), không thanh toán riêng.
     */
    private static void requireWaitingForTransfer(Booking booking, LocalDateTime now) {
        if (booking.getPackageId() == null) {
            if (booking.getStatus() == BookingStatus.RESUBMIT_REQUESTED) {
                return;
            }
            if (booking.getStatus() == BookingStatus.HOLDING) {
                requireHoldNotExpired(booking, now);
                return;
            }
        }
        throw notWaitingForPayment();
    }

    /** Đang giữ chỗ nhưng đã quá 5 phút: coi như hết hạn dù job UC37 chưa kịp đổi trạng thái (BR03). */
    private static void requireHoldNotExpired(Booking booking, LocalDateTime now) {
        if (!booking.getHoldExpiresAt().isAfter(now)) {
            throw holdExpired();
        }
    }

    private static AppException holdExpired() {
        return new AppException("Đã hết thời gian giữ chỗ. Slot đã được nhả. (MSG33)", HttpStatus.CONFLICT);
    }

    private static AppException alreadyReported() {
        return new AppException("Booking này đã được báo thanh toán.", HttpStatus.CONFLICT);
    }

    private static AppException notWaitingForPayment() {
        return new AppException("Booking này không ở bước thanh toán.", HttpStatus.CONFLICT);
    }
}
