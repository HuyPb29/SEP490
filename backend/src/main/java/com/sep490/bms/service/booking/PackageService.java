package com.sep490.bms.service.booking;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.dto.booking.BatchOfferPublicResponse;
import com.sep490.bms.dto.booking.BookingListItem;
import com.sep490.bms.dto.booking.BookingSummaryResponse.SlotPrice;
import com.sep490.bms.dto.booking.PackagePreviewResponse;
import com.sep490.bms.dto.booking.PackagePreviewResponse.BatchOfferStatus;
import com.sep490.bms.dto.booking.PackagePreviewResponse.Conflict;
import com.sep490.bms.dto.booking.PackageDetailResponse;
import com.sep490.bms.dto.booking.PackageRequest;
import com.sep490.bms.dto.booking.PackageRequest.WeeklySlot;
import com.sep490.bms.dto.promotion.VoucherCheckRequest;
import com.sep490.bms.dto.promotion.VoucherSelection;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.booking.BookingPackage;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.BookingType;
import com.sep490.bms.entity.enums.PackageType;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.notification.NotificationType;
import com.sep490.bms.entity.promotion.Voucher;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.booking.BookingPackageRepository;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.location.BatchOfferRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.promotion.VoucherRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.LocationQueryService;
import com.sep490.bms.service.notification.NotificationService;
import com.sep490.bms.service.promotion.LoyaltyPointService;
import com.sep490.bms.service.promotion.VoucherService;

import lombok.RequiredArgsConstructor;

/**
 * Đặt nhiều buổi (UC15): gói (booking tổng) gồm nhiều buổi con, thanh toán một lần (BR10, BR26).
 * Định kỳ hay tự chọn chỉ là cách nhập buổi; sau khi xác nhận lịch, gói là danh sách buổi con (BR27).
 */
@Service
@RequiredArgsConstructor
public class PackageService {

    /** BR27: định kỳ kéo dài từ 1 đến 3 tháng; tự chọn trong vòng tối đa 3 tháng. */
    static final int MIN_MONTHS = 1;
    static final int MAX_MONTHS = 3;
    /** Thời gian giữ chỗ của gói, tính từ lúc bấm xác nhận lịch (P27, BR53): cố định (D154). */
    static final int HOLD_MINUTES = 15;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    /** Loại thông báo khi tặng voucher của chương trình theo lô (FR124). */
    static final String BATCH_OFFER_VOUCHER = "BATCH_OFFER_VOUCHER";

    private final LocationQueryService locationQueryService;
    private final BatchOfferRepository batchOfferRepository;
    private final VoucherRepository voucherRepository;
    private final CourtRepository courtRepository;
    private final BookingService bookingService;
    private final SlotAvailabilityService slotAvailabilityService;
    private final PriceCalculator priceCalculator;
    private final VoucherService voucherService;
    private final LoyaltyPointService loyaltyPointService;
    private final BookingPackageRepository bookingPackageRepository;
    private final BookingRepository bookingRepository;
    private final BookingCodeGenerator bookingCodeGenerator;
    private final NotificationService notificationService;

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
        return runningOffers(locationId, today);
    }

    private List<BatchOfferPublicResponse> runningOffers(Long locationId, LocalDate today) {
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
     * UC15 #1–6, #9, #10: Player nhập mẫu hoặc chọn buổi rồi xem lịch toàn kỳ, số tiền và chương trình theo lô
     * trước khi bấm xác nhận lịch. Không tạo gói, không giữ chỗ, không trừ voucher hay điểm (BR53, FR74, FR75).
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
        List<Planned> bookable = sessions.stream().filter(s -> !s.hasConflict()).toList();
        Quote quote = quote(player, location, bookable, request);
        BatchOfferStatus offer = offerStatus(location.getId(), now.toLocalDate(), quote.finalAmount());

        Map<Planned, Priced> pricedBySession = new HashMap<>();
        quote.sessions().forEach(p -> pricedBySession.put(p.session(), p));
        int conflicts = sessions.size() - bookable.size();
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
                .sessions(sessions.stream().map(s -> toResponse(s, pricedBySession.get(s))).toList())
                .listAmount(quote.listAmount())
                .voucherDiscount(quote.voucherDiscount())
                .pointsUsed(quote.pointsUsed())
                .pointDiscount(quote.pointDiscount())
                .finalAmount(quote.finalAmount())
                .batchOffer(offer)
                .build();
    }

    /**
     * UC15 #7–8, #11, FR41, FR46, BR53: Player bấm xác nhận lịch. Kiểm tra trùng lại một lần nữa; còn buổi trùng
     * thì chưa giữ chỗ, báo số buổi và danh sách (MSG44). Không trùng thì tạo gói Đang giữ chỗ và các buổi con
     * (booking SESSION), lưu từng slot, giữ chỗ 15 phút tính từ lúc bấm (P27); trừ voucher, điểm trên cả gói rồi
     * chia cho từng buổi (BR28). Tất cả trong một giao dịch: lỗi ở bước nào thì không lưu gì.
     */
    @Transactional
    public PackageDetailResponse create(UserPrincipal player, PackageRequest request) {
        return create(player, request, LocalDateTime.now());
    }

    PackageDetailResponse create(UserPrincipal player, PackageRequest request, LocalDateTime now) {
        // BR35: một gói tính là một booking chờ thanh toán.
        bookingService.requirePendingPaymentLimit(player.getId(), now);
        Court court = courtRepository.findByIdAndActiveTrue(request.courtId())
                .orElseThrow(() -> new AppException("Không tìm thấy sân", HttpStatus.NOT_FOUND));
        Location location = locationQueryService.findActive(court.getLocationId());
        bookingService.requireOwnTeam(player.getId(), request.teamId());
        LocalDate today = now.toLocalDate();

        List<Planned> sessions = markConflicts(location, plan(request, court, today), now);
        List<Planned> conflicts = sessions.stream().filter(Planned::hasConflict).toList();
        if (!conflicts.isEmpty()) {
            throw sessionsTaken(conflicts);
        }
        if (sessions.size() < 2) {
            throw tooFewSessions();
        }
        List<Priced> priced = price(sessions);
        BigDecimal listAmount = sum(priced);
        // Cột DATETIME2(0) chỉ lưu đến giây: bỏ phần lẻ để created_at và hold_expires_at cách nhau đúng 15 phút.
        LocalDateTime createdAt = now.truncatedTo(ChronoUnit.SECONDS);
        LocalDateTime holdExpiresAt = createdAt.plusMinutes(HOLD_MINUTES);

        // Lưu với giá niêm yết; consumeForPackage, redeemForPackage tự ghi số giảm và finalAmount vào gói.
        BookingPackage pkg = bookingPackageRepository.save(BookingPackage.builder()
                .locationId(location.getId())
                .playerId(player.getId())
                .packageType(request.packageType())
                .startDate(sessions.get(0).date())
                .endDate(sessions.get(sessions.size() - 1).date())
                .listAmount(listAmount)
                .finalAmount(listAmount)
                .status(BookingStatus.HOLDING)
                .holdExpiresAt(holdExpiresAt)
                .createdAt(createdAt)
                .build());
        List<Booking> bookings = new ArrayList<>();
        for (Priced session : priced) {
            Booking booking = bookingRepository.save(Booking.builder()
                    .bookingCode(bookingCodeGenerator.next())
                    .bookingType(BookingType.SESSION)
                    .locationId(location.getId())
                    .courtId(session.session().court().getId())
                    .playerId(player.getId())
                    .teamId(request.teamId())
                    .packageId(pkg.getId())
                    .playDate(session.session().date())
                    .startMinute(session.session().startMinute())
                    .endMinute(session.session().endMinute())
                    .listAmount(session.listAmount())
                    .finalAmount(session.listAmount())
                    .status(BookingStatus.HOLDING)
                    .holdExpiresAt(holdExpiresAt)
                    .createdAt(createdAt)
                    .build());
            try {
                bookingService.saveSlots(booking, session.slots());
            } catch (AppException e) {
                // Người khác vừa giữ slot của buổi này sau bước kiểm tra lại (ux_slot_active): báo như MSG44.
                if (e.getStatus() == HttpStatus.CONFLICT) {
                    throw sessionsTaken(List.of(session.session()));
                }
                throw e;
            }
            bookings.add(booking);
        }

        // Voucher trước, điểm sau: trần điểm tính trên số tiền còn lại sau voucher (BR41).
        useVoucher(pkg.getId(), request);
        usePoints(pkg.getId(), request);
        List<Priced> allocated = allocate(priced, pkg.getVoucherDiscount(), pkg.getPointsUsed(), pkg.getPointDiscount());
        for (int i = 0; i < bookings.size(); i++) {
            Booking booking = bookings.get(i);
            Priced share = allocated.get(i);
            booking.setVoucherDiscount(share.voucherDiscount());
            booking.setPointsUsed(share.pointsUsed());
            booking.setPointDiscount(share.pointDiscount());
            booking.setFinalAmount(share.finalAmount());
        }
        // BR47: gói xác nhận lịch trong thời gian chương trình và đạt mức thì ghi chương trình để tặng voucher
        // khi thanh toán gói được xác nhận.
        BatchOfferStatus offer = offerStatus(location.getId(), today, pkg.getFinalAmount());
        if (offer != null && offer.isReached()) {
            pkg.setBatchOfferId(offer.getId());
        }
        bookingRepository.saveAllAndFlush(bookings);
        bookingPackageRepository.saveAndFlush(pkg);
        Map<Long, String> courtNames = new HashMap<>();
        priced.forEach(p -> courtNames.put(p.session().court().getId(), p.session().court().getName()));
        return toDetail(pkg, location, bookings, courtNames);
    }

    /**
     * UC37, BR53: gói Đang giữ chỗ quá 15 phút mà Player chưa báo thanh toán thì gói và các buổi chuyển Hết hạn,
     * nhả slot, trả voucher và điểm (BR40, BR45), báo Player (FR124, MSG110). Khóa dòng gói rồi kiểm tra lại:
     * Player có thể vừa gửi chứng từ sau lần quét của job. Mỗi gói một giao dịch riêng.
     *
     * @return true nếu gói vừa được chuyển Hết hạn
     */
    @Transactional
    public boolean expireHold(Long packageId, LocalDateTime now) {
        BookingPackage pkg = bookingPackageRepository.findByIdForUpdate(packageId).orElse(null);
        if (pkg == null || pkg.getStatus() != BookingStatus.HOLDING || pkg.getHoldExpiresAt() == null
                || pkg.getHoldExpiresAt().isAfter(now)) {
            return false;
        }
        settleFailed(pkg, BookingStatus.EXPIRED);
        notificationService.notifyOnce(pkg.getPlayerId(), NotificationType.BOOKING_HOLD_EXPIRED,
                "Gói đặt nhiều buổi đã hết hạn giữ chỗ",
                "Gói đặt nhiều buổi từ " + pkg.getStartDate().format(DATE) + " đến " + pkg.getEndDate().format(DATE)
                        + " đã bị hủy vì quá hạn thanh toán. Các slot đã được nhả.",
                "PACKAGE", packageId);
        return true;
    }

    /**
     * UC18 (gói): gói của chính Player đang đăng nhập; gói của người khác trả 403 (NFR07).
     */
    @Transactional(readOnly = true)
    public BookingPackage getForPlayer(Long packageId, Long playerId) {
        BookingPackage pkg = bookingPackageRepository.findById(packageId).orElseThrow(PackageService::packageNotFound);
        requireOwner(pkg, playerId);
        return pkg;
    }

    /** Gói không phải của Player này thì 403. Dùng cả khi xem và khi khóa dòng để thanh toán. */
    public void requireOwner(BookingPackage pkg, Long playerId) {
        if (!playerId.equals(pkg.getPlayerId())) {
            throw new AppException("Bạn không có quyền xem gói đặt nhiều buổi này", HttpStatus.FORBIDDEN);
        }
    }

    /**
     * UC18, UC19 (gói): đọc và khóa dòng gói đến hết giao dịch thanh toán, để bấm Báo đã thanh toán hai lần
     * hay Staff và job cùng xử lý thì chạy lần lượt (FR56). Không kiểm tra người đặt.
     */
    public BookingPackage lockForPayment(Long packageId) {
        return bookingPackageRepository.findByIdForUpdate(packageId).orElseThrow(PackageService::packageNotFound);
    }

    /**
     * FR43, BR26: cả gói thanh toán một lần nên gói và mọi buổi con đổi trạng thái cùng nhau theo bước thanh toán.
     * Chạy trong giao dịch của bên gọi, sau khi đã khóa dòng gói.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public BookingPackage changeStatus(BookingPackage pkg, BookingStatus status) {
        pkg.setStatus(status);
        bookingPackageRepository.saveAndFlush(pkg);
        for (Booking session : sessionsOf(pkg.getId())) {
            bookingService.changeStatus(session, status);
        }
        return pkg;
    }

    /** Các buổi của gói theo ngày giờ chơi. */
    @Transactional(readOnly = true)
    public List<Booking> sessionsOf(Long packageId) {
        return bookingRepository.findByPackageIdOrderByPlayDateAscStartMinuteAscIdAsc(packageId);
    }

    /**
     * Giờ kết thúc của buổi đầu tiên: hạn gửi lại chứng từ của gói (P07) và mốc hết giờ chơi mà vẫn chờ Staff
     * (BR03). Đề xuất, chưa duyệt: requirement chỉ nói "hết giờ chơi" cho booking lẻ; với gói lấy buổi đầu tiên
     * để buổi đầu không bị chơi khi gói chưa được xác nhận.
     */
    @Transactional(readOnly = true)
    public LocalDateTime firstSessionEnd(Long packageId) {
        Booking first = sessionsOf(packageId).get(0);
        return first.getPlayDate().atStartOfDay().plusMinutes(first.getEndMinute());
    }

    private static AppException packageNotFound() {
        return new AppException("Không tìm thấy gói đặt nhiều buổi", HttpStatus.NOT_FOUND);
    }

    /**
     * Gói thất bại (hết hạn giữ chỗ hoặc bị từ chối thanh toán): gói và các buổi đổi trạng thái, nhả slot của mọi
     * buổi, trả voucher và điểm đã dùng (BR40, BR45). Hai hàm trả lại chỉ nhận gói đã ở trạng thái thất bại nên
     * chạy sau khi đổi trạng thái. Chạy trong giao dịch của bên gọi, sau khi đã khóa dòng gói.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void settleFailed(BookingPackage pkg, BookingStatus status) {
        pkg.setStatus(status);
        bookingPackageRepository.saveAndFlush(pkg);
        for (Booking session : sessionsOf(pkg.getId())) {
            bookingService.changeStatus(session, status);
            bookingService.releaseSlots(session.getId());
        }
        voucherService.restoreForFailedPackage(pkg.getId());
        loyaltyPointService.restoreForFailedPackage(pkg.getId());
    }

    /**
     * UC15 #9, FR44, BR47: thanh toán gói được xác nhận mà gói đã đạt mức của chương trình theo lô lúc xác nhận lịch
     * thì tặng voucher của chương trình vào tài khoản Player (loại Player được chỉ định, BR48) và báo Player.
     * Chương trình đã bị xóa hoặc voucher không tặng được thì không tặng.
     *
     * @return true nếu đã tặng
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean grantBatchOfferVoucher(BookingPackage pkg) {
        if (pkg.getBatchOfferId() == null) {
            return false;
        }
        BatchOffer offer = batchOfferRepository.findById(pkg.getBatchOfferId()).orElse(null);
        if (offer == null || !voucherService.grantForBatchOffer(offer.getVoucherId(), pkg.getPlayerId(),
                "Ưu đãi đặt theo lô: " + offer.getName() + " (gói #" + pkg.getId() + ")")) {
            return false;
        }
        notificationService.notifyOnce(pkg.getPlayerId(), BATCH_OFFER_VOUCHER, "Bạn được tặng voucher",
                "Gói đặt nhiều buổi của bạn đạt mức của chương trình " + offer.getName()
                        + ". Voucher đã được thêm vào tài khoản.",
                "PACKAGE", pkg.getId());
        return true;
    }

    /** Các gói theo id, đọc một lần cho một trang giao dịch chờ xác nhận (UC19 #1). */
    @Transactional(readOnly = true)
    public Map<Long, BookingPackage> getByIds(Collection<Long> packageIds) {
        if (packageIds.isEmpty()) {
            return Map.of();
        }
        return bookingPackageRepository.findAllById(packageIds).stream()
                .collect(Collectors.toMap(BookingPackage::getId, Function.identity()));
    }

    /** UC15 #6, FR74: trừ lượt voucher trên cả gói; lỗi do voucher không còn dùng được thì báo MSG108. */
    private void useVoucher(Long packageId, PackageRequest request) {
        VoucherSelection selection = voucherSelection(request);
        if (selection == null) {
            return;
        }
        try {
            voucherService.consumeForPackage(packageId, selection);
        } catch (AppException e) {
            throw BookingService.noLongerUsable("Mã giảm giá", e);
        }
    }

    /** UC15 #6, FR75: trừ điểm trên cả gói; LoyaltyPointService kiểm tra lại số dư và trần 50% (BR41). */
    private void usePoints(Long packageId, PackageRequest request) {
        Integer points = request.pointsToUse();
        if (points == null || points == 0) {
            return;
        }
        try {
            loyaltyPointService.redeemForPackage(packageId, points);
        } catch (AppException e) {
            throw BookingService.noLongerUsable("Số điểm", e);
        }
    }

    /** MSG44: số buổi và danh sách các buổi bị trùng (ngày, giờ, sân). */
    private static AppException sessionsTaken(List<Planned> sessions) {
        String list = sessions.stream()
                .map(s -> s.date().format(DATE) + " " + MinuteTime.format(s.startMinute()) + "–"
                        + MinuteTime.format(s.endMinute()) + " " + s.court().getName())
                .collect(Collectors.joining("; "));
        return new AppException("Bạn có " + sessions.size() + " buổi vừa bị đặt trùng: " + list
                + ". Các buổi này đã được đánh dấu trên lịch, vui lòng chọn slot bù hoặc bỏ buổi. (MSG44)",
                HttpStatus.CONFLICT);
    }

    /** Gói vừa tạo, cùng dạng với chi tiết gói ở UC17 (chưa có thanh toán). */
    private static PackageDetailResponse toDetail(BookingPackage pkg, Location location, List<Booking> bookings,
            Map<Long, String> courtNames) {
        return PackageDetailResponse.builder()
                .id(pkg.getId())
                .packageType(pkg.getPackageType())
                .locationId(location.getId())
                .locationName(location.getName())
                .locationAddress(location.getAddress())
                .startDate(pkg.getStartDate())
                .endDate(pkg.getEndDate())
                .listAmount(pkg.getListAmount())
                .voucherDiscount(pkg.getVoucherDiscount())
                .pointsUsed(pkg.getPointsUsed())
                .pointDiscount(pkg.getPointDiscount())
                .finalAmount(pkg.getFinalAmount())
                .status(pkg.getStatus())
                .holdExpiresAt(pkg.getHoldExpiresAt())
                .createdAt(pkg.getCreatedAt())
                .sessions(bookings.stream().map(b -> BookingListItem.builder()
                        .id(b.getId())
                        .bookingCode(b.getBookingCode())
                        .locationId(location.getId())
                        .locationName(location.getName())
                        .courtName(courtNames.get(b.getCourtId()))
                        .playDate(b.getPlayDate())
                        .startTime(MinuteTime.format(b.getStartMinute()))
                        .endTime(MinuteTime.format(b.getEndMinute()))
                        .finalAmount(b.getFinalAmount())
                        .status(b.getStatus())
                        .holdExpiresAt(b.getHoldExpiresAt())
                        .createdAt(b.getCreatedAt())
                        .build()).toList())
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

    /** Một buổi đặt được kèm giá từng slot và phần giảm đã chia cho buổi này (BR28). */
    record Priced(Planned session, List<SlotPrice> slots, BigDecimal listAmount, BigDecimal voucherDiscount,
            int pointsUsed, BigDecimal pointDiscount) {

        BigDecimal finalAmount() {
            return listAmount.subtract(voucherDiscount).subtract(pointDiscount);
        }
    }

    /** Số tiền của cả gói và của từng buổi đặt được. */
    record Quote(List<Priced> sessions, BigDecimal listAmount, BigDecimal voucherDiscount, int pointsUsed,
            BigDecimal pointDiscount) {

        BigDecimal finalAmount() {
            return listAmount.subtract(voucherDiscount).subtract(pointDiscount);
        }
    }

    /**
     * Danh sách buổi của gói theo ngày giờ chơi. Định kỳ: luôn kiểm mẫu ban đầu (MSG41); Player gửi danh sách
     * đã xử lý buổi trùng thì dùng danh sách đó, các buổi phải nằm trong thời gian của mẫu. Tự chọn: các buổi
     * Player chọn, ít nhất 2 buổi, trong vòng 3 tháng (MSG91). Cả hai cách: buổi xa nhất không quá 3 tháng kể từ
     * hôm nay (D162).
     */
    List<Planned> plan(PackageRequest request, Court court, LocalDate today) {
        List<Planned> sessions;
        if (request.packageType() == PackageType.RECURRING) {
            List<Planned> generated = generateRecurring(request, court, today);
            sessions = request.sessions() == null ? generated : explicitSessions(request, court, today);
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
        requireWithinBookingWindow(sessions.get(sessions.size() - 1).date(), today);
        return sessions;
    }

    /**
     * D162, BR27, MSG115: mọi buổi của gói nằm trong 3 tháng kể từ hôm nay (tính cả hôm nay, như cách đếm của BR27), khớp với
     * lịch 3 tháng Owner/Staff xem được (D140). Hôm nay 07/11 thì buổi xa nhất là 06/02 năm sau.
     */
    private static void requireWithinBookingWindow(LocalDate lastDate, LocalDate today) {
        LocalDate latest = today.plusMonths(MAX_MONTHS).minusDays(1);
        if (lastDate.isAfter(latest)) {
            throw new AppException("Chỉ đặt được các buổi trong vòng 3 tháng kể từ hôm nay, muộn nhất ngày "
                    + latest.format(DATE) + ". (MSG115)");
        }
    }

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

    /**
     * UC15 #6, BR14, BR41: giá niêm yết của từng buổi đặt được; voucher áp một lần trên tổng gói, điểm tính sau
     * voucher, tối đa 50% số tiền còn lại. Chỉ kiểm tra và tính, chưa trừ (FR74, FR75).
     */
    private Quote quote(UserPrincipal player, Location location, List<Planned> bookable, PackageRequest request) {
        List<Priced> priced = price(bookable);
        BigDecimal listAmount = sum(priced);
        if (priced.isEmpty()) {
            return new Quote(priced, listAmount, BigDecimal.ZERO, 0, BigDecimal.ZERO);
        }
        BigDecimal voucherDiscount = voucherDiscount(player, location.getId(), listAmount, request);
        int points = request.pointsToUse() == null ? 0 : request.pointsToUse();
        BigDecimal pointDiscount = points == 0 ? BigDecimal.ZERO
                : loyaltyPointService.preview(player.getId(), location.getId(), listAmount.subtract(voucherDiscount), points);
        return new Quote(allocate(priced, voucherDiscount, points, pointDiscount),
                listAmount, voucherDiscount, points, pointDiscount);
    }

    /** Giá niêm yết từng slot 30 phút của mỗi buổi (FR20), như booking lẻ. */
    List<Priced> price(List<Planned> bookable) {
        return bookable.stream().map(session -> {
            List<SlotPrice> slots = BookingService.toSlots(priceCalculator.rangePrices(session.court().getId(),
                    session.date(), session.startMinute(), session.endMinute()));
            BigDecimal list = slots.stream().map(SlotPrice::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
            return new Priced(session, slots, list, BigDecimal.ZERO, 0, BigDecimal.ZERO);
        }).toList();
    }

    /**
     * BR28: chia phần giảm của cả gói cho từng buổi theo tỷ lệ giá niêm yết của buổi; mỗi buổi làm tròn xuống,
     * phần lẻ dồn vào buổi cuối. Voucher chia theo đồng, điểm chia theo điểm (1 điểm = 500 đồng, P10) để số điểm
     * trả lại khi sân hủy một buổi khớp với số tiền đã giảm. Buổi nào không còn tiền phải trả thì không chia được.
     */
    static List<Priced> allocate(List<Priced> sessions, BigDecimal voucherDiscount, int points, BigDecimal pointDiscount) {
        BigDecimal total = sum(sessions);
        int last = sessions.size() - 1;
        List<Priced> result = new ArrayList<>();
        BigDecimal voucherLeft = voucherDiscount;
        int pointsLeft = points;
        BigDecimal pointValue = points == 0 ? BigDecimal.ZERO
                : pointDiscount.divide(BigDecimal.valueOf(points), 0, RoundingMode.UNNECESSARY);
        for (int i = 0; i < sessions.size(); i++) {
            Priced session = sessions.get(i);
            BigDecimal voucherShare;
            int pointShare;
            if (i == last) {
                voucherShare = voucherLeft;
                pointShare = pointsLeft;
            } else {
                voucherShare = voucherDiscount.multiply(session.listAmount()).divide(total, 0, RoundingMode.DOWN);
                pointShare = BigDecimal.valueOf(points).multiply(session.listAmount())
                        .divide(total, 0, RoundingMode.DOWN).intValueExact();
            }
            voucherLeft = voucherLeft.subtract(voucherShare);
            pointsLeft -= pointShare;
            Priced allocated = new Priced(session.session(), session.slots(), session.listAmount(), voucherShare,
                    pointShare, pointValue.multiply(BigDecimal.valueOf(pointShare)));
            if (allocated.finalAmount().signum() <= 0) {
                throw new AppException("Phần giảm quá lớn so với giá của buổi ngày " + session.session().date()
                        + ", không chia được cho từng buổi. Vui lòng dùng ít điểm hơn.");
            }
            result.add(allocated);
        }
        return result;
    }

    /**
     * BR47, MSG93: chương trình theo lô đang diễn ra hôm nay (các chương trình của một địa điểm không trùng thời
     * gian) và gói đã đạt mức tặng voucher chưa, tính trên số tiền thực trả sau voucher và điểm.
     */
    private BatchOfferStatus offerStatus(Long locationId, LocalDate today, BigDecimal finalAmount) {
        List<BatchOfferPublicResponse> offers = runningOffers(locationId, today);
        if (offers.isEmpty()) {
            return null;
        }
        BatchOfferPublicResponse offer = offers.get(0);
        boolean reached = finalAmount.compareTo(offer.getMinPackageAmount()) >= 0;
        return BatchOfferStatus.builder()
                .id(offer.getId())
                .name(offer.getName())
                .minPackageAmount(offer.getMinPackageAmount())
                .voucherName(offer.getVoucherName())
                .reached(reached)
                .message(reached ? null : "Gói có tổng " + money(finalAmount) + " đồng, chưa đủ "
                        + money(offer.getMinPackageAmount()) + " đồng để được tặng voucher của chương trình "
                        + offer.getName() + ".")
                .build();
    }

    /**
     * Chỉ kiểm tra và tính số giảm của voucher trên tổng gói (BR14); voucher không dùng được thì báo MSG34
     * kèm lý do, như booking lẻ.
     */
    private BigDecimal voucherDiscount(UserPrincipal player, Long locationId, BigDecimal listAmount,
            PackageRequest request) {
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

    static VoucherSelection voucherSelection(PackageRequest request) {
        if (request.voucherGrantId() != null) {
            return new VoucherSelection(null, request.voucherGrantId());
        }
        return StringUtils.hasText(request.voucherCode()) ? new VoucherSelection(request.voucherCode(), null) : null;
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

    private static BigDecimal sum(List<Priced> sessions) {
        return sessions.stream().map(Priced::listAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String money(BigDecimal amount) {
        return String.format(Locale.forLanguageTag("vi-VN"), "%,d", amount.longValueExact());
    }

    private static PackagePreviewResponse.Session toResponse(Planned session, Priced priced) {
        return PackagePreviewResponse.Session.builder()
                .date(session.date())
                .courtId(session.court().getId())
                .courtName(session.court().getName())
                .startMinute(session.startMinute())
                .endMinute(session.endMinute())
                .startTime(MinuteTime.format(session.startMinute()))
                .endTime(MinuteTime.format(session.endMinute()))
                .conflict(session.conflict())
                .listAmount(priced == null ? null : priced.listAmount())
                .voucherDiscount(priced == null ? null : priced.voucherDiscount())
                .pointsUsed(priced == null ? null : priced.pointsUsed())
                .pointDiscount(priced == null ? null : priced.pointDiscount())
                .finalAmount(priced == null ? null : priced.finalAmount())
                .build();
    }

    private static boolean isPublished(Voucher voucher) {
        return voucher != null && voucher.getStatus() == VoucherStatus.PUBLISHED;
    }
}
