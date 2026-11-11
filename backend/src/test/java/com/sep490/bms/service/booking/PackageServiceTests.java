package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;

import com.sep490.bms.dto.booking.BatchOfferPublicResponse;
import com.sep490.bms.dto.booking.BookingListItem;
import com.sep490.bms.dto.booking.PackageDetailResponse;
import com.sep490.bms.dto.booking.PackagePreviewResponse;
import com.sep490.bms.dto.booking.PackagePreviewResponse.Conflict;
import com.sep490.bms.dto.booking.PackageRequest;
import com.sep490.bms.dto.booking.PackageRequest.WeeklySlot;
import com.sep490.bms.dto.promotion.VoucherCheckRequest;
import com.sep490.bms.dto.promotion.VoucherCheckResponse;
import com.sep490.bms.dto.promotion.VoucherSelection;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.booking.BookingPackage;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.BookingType;
import com.sep490.bms.entity.enums.DiscountType;
import com.sep490.bms.entity.enums.PackageType;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.location.Court;
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

/** UC15: đặt nhiều buổi. */
class PackageServiceTests {

    private static final Long LOCATION = 1L;
    private static final Long PLAYER = 20L;
    private static final Long COURT = 11L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 7);
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 7, 9, 0);
    private static final LocalDate DEC_1 = LocalDate.of(2026, 12, 1);
    private static final LocalDate DEC_31 = LocalDate.of(2026, 12, 31);
    /** Thứ Ba 18:00–20:00 và thứ Sáu 06:00–07:00. */
    private static final WeeklySlot TUESDAY_EVENING = new WeeklySlot(2, 1080, 1200);
    private static final WeeklySlot FRIDAY_MORNING = new WeeklySlot(5, 360, 420);

    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final BatchOfferRepository offers = mock(BatchOfferRepository.class);
    private final VoucherRepository vouchers = mock(VoucherRepository.class);
    private final CourtRepository courts = mock(CourtRepository.class);
    private final BookingService bookingService = mock(BookingService.class);
    private final SlotAvailabilityService availability = mock(SlotAvailabilityService.class);
    private final PriceCalculator prices = mock(PriceCalculator.class);
    private final VoucherService voucherService = mock(VoucherService.class);
    private final LoyaltyPointService points = mock(LoyaltyPointService.class);
    private final BookingPackageRepository packages = mock(BookingPackageRepository.class);
    private final BookingRepository bookings = mock(BookingRepository.class);
    private final BookingCodeGenerator codes = mock(BookingCodeGenerator.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final PackageService service = new PackageService(locations, offers, vouchers, courts, bookingService,
            availability, prices, voucherService, points, packages, bookings, codes, notifications);

    /** Gói vừa lưu trong lần gọi create gần nhất (mock save gán id 50). */
    private BookingPackage savedPackage;
    private final List<Booking> savedBookings = new ArrayList<>();

    private final UserPrincipal player = UserPrincipal.builder().id(PLAYER).role(Role.PLAYER).build();
    private final Location location = Location.builder().id(LOCATION).name("Cầu lông A").build();
    private final Court court = Court.builder().id(COURT).locationId(LOCATION).name("Sân 1").build();

    private final Court court2 = Court.builder().id(12L).locationId(LOCATION).name("Sân 2").build();

    @BeforeEach
    void defaults() {
        when(locations.findActive(LOCATION)).thenReturn(location);
        when(courts.findByIdAndActiveTrue(COURT)).thenReturn(Optional.of(court));
        when(courts.findByIdAndActiveTrue(12L)).thenReturn(Optional.of(court2));
        when(availability.findProblem(eq(LOCATION), anyLong(), any(), anyInt(), anyInt())).thenReturn(Optional.empty());
        // Sân 1: 60.000 đồng/slot 30 phút; sân 2: 80.000 đồng/slot.
        when(prices.rangePrices(anyLong(), any(), anyInt(), anyInt())).thenAnswer(inv -> {
            long courtId = inv.getArgument(0);
            int start = inv.getArgument(2);
            int end = inv.getArgument(3);
            Map<Integer, BigDecimal> result = new LinkedHashMap<>();
            for (int s = start; s < end; s += 30) {
                result.put(s, new BigDecimal(courtId == 12L ? "80000" : "60000"));
            }
            return result;
        });
        when(offers.findAllByLocationIdOrderByStartDateDescIdDesc(LOCATION)).thenReturn(List.of());
        when(packages.save(any(BookingPackage.class))).thenAnswer(inv -> {
            savedPackage = inv.getArgument(0);
            savedPackage.setId(50L);
            return savedPackage;
        });
        when(bookings.save(any(Booking.class))).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            b.setId(100L + savedBookings.size());
            savedBookings.add(b);
            return b;
        });
        when(codes.next()).thenReturn("BK1", "BK2", "BK3", "BK4", "BK5", "BK6", "BK7");
    }

    private static PackageRequest withDiscounts(PackageRequest r, String code, Integer pointsToUse) {
        return new PackageRequest(r.packageType(), r.courtId(), r.startDate(), r.endDate(), r.weeklySlots(),
                r.sessions(), r.teamId(), code, null, pointsToUse);
    }

    private void voucherGives(String discount) {
        when(voucherService.check(eq(player), any(VoucherCheckRequest.class))).thenAnswer(inv -> {
            VoucherCheckRequest req = inv.getArgument(1);
            BigDecimal d = new BigDecimal(discount);
            return new VoucherCheckResponse(5L, null, req.orderAmount(), d, req.orderAmount().subtract(d));
        });
    }

    private static PackageRequest.Session session(LocalDate date, Long courtId, int start, int end) {
        return new PackageRequest.Session(date, courtId, start, end);
    }

    private static PackageRequest custom(PackageRequest.Session... sessions) {
        return new PackageRequest(PackageType.CUSTOM, COURT, null, null, null, List.of(sessions), null, null, null, null);
    }

    private static BatchOffer offer(long id, LocalDate start, LocalDate end, long voucherId) {
        return BatchOffer.builder().id(id).locationId(LOCATION).name("Chương trình " + id)
                .startDate(start).endDate(end).minPackageAmount(new BigDecimal("1000000")).voucherId(voucherId).build();
    }

    private static Voucher voucher(long id, VoucherStatus status) {
        return Voucher.builder().id(id).locationId(LOCATION).name("Voucher " + id).code("SECRET" + id)
                .discountType(DiscountType.AMOUNT).discountValue(new BigDecimal("50000")).status(status).build();
    }

    private static PackageRequest recurring(LocalDate start, LocalDate end, WeeklySlot... slots) {
        return new PackageRequest(PackageType.RECURRING, COURT, start, end,
                slots.length == 0 ? null : List.of(slots), null, null, null, null, null);
    }

    // ===================== 12.1: chương trình theo lô công khai =====================

    @Test
    void batchOffersOnlyThoseRunningTodayWithPublishedVoucher() {
        BatchOffer running = offer(1, TODAY.minusDays(3), TODAY.plusDays(3), 10);
        BatchOffer startsToday = offer(2, TODAY, TODAY.plusDays(30), 11);
        BatchOffer endsToday = offer(3, TODAY.minusDays(30), TODAY, 12);
        BatchOffer future = offer(4, TODAY.plusDays(1), TODAY.plusDays(10), 13);
        BatchOffer past = offer(5, TODAY.minusDays(10), TODAY.minusDays(1), 14);
        BatchOffer disabledVoucher = offer(6, TODAY.minusDays(1), TODAY.plusDays(1), 15);
        when(offers.findAllByLocationIdOrderByStartDateDescIdDesc(LOCATION))
                .thenReturn(List.of(future, startsToday, disabledVoucher, running, endsToday, past));
        when(vouchers.findAllById(anyList())).thenReturn(List.of(
                voucher(10, VoucherStatus.PUBLISHED), voucher(11, VoucherStatus.PUBLISHED),
                voucher(12, VoucherStatus.PUBLISHED), voucher(15, VoucherStatus.DISABLED)));

        List<BatchOfferPublicResponse> result = service.listActiveBatchOffers(LOCATION, TODAY);

        assertThat(result).extracting(BatchOfferPublicResponse::getId).containsExactly(3L, 1L, 2L);
        assertThat(result.get(1).getVoucherName()).isEqualTo("Voucher 10");
        assertThat(result.get(1).getDiscountType()).isEqualTo("AMOUNT");
        assertThat(result.get(1).getMinPackageAmount()).isEqualByComparingTo("1000000");
    }

    @Test
    void batchOffersEmptyWithoutReadingVouchers() {
        when(offers.findAllByLocationIdOrderByStartDateDescIdDesc(LOCATION))
                .thenReturn(List.of(offer(5, TODAY.minusDays(10), TODAY.minusDays(1), 14)));

        assertThat(service.listActiveBatchOffers(LOCATION, TODAY)).isEmpty();
        verifyNoInteractions(vouchers);
    }

    @Test
    void batchOffersOfLockedLocationIsNotFound() {
        when(locations.findActive(LOCATION)).thenThrow(new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> service.listActiveBatchOffers(LOCATION, TODAY))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ===================== 12.2: sinh buổi theo mẫu định kỳ =====================

    @Test
    void recurringGeneratesEveryMatchingWeekdayInOrder() {
        PackagePreviewResponse result = service.preview(player,
                recurring(DEC_1, DEC_31, FRIDAY_MORNING, TUESDAY_EVENING), NOW);

        // Tháng 12/2026: thứ Ba 1, 8, 15, 22, 29; thứ Sáu 4, 11, 18, 25.
        assertThat(result.getTotalSessions()).isEqualTo(9);
        assertThat(result.getSessions()).extracting(PackagePreviewResponse.Session::getDate).containsExactly(
                DEC_1, LocalDate.of(2026, 12, 4), LocalDate.of(2026, 12, 8), LocalDate.of(2026, 12, 11),
                LocalDate.of(2026, 12, 15), LocalDate.of(2026, 12, 18), LocalDate.of(2026, 12, 22),
                LocalDate.of(2026, 12, 25), LocalDate.of(2026, 12, 29));
        PackagePreviewResponse.Session first = result.getSessions().get(0);
        assertThat(first.getStartTime()).isEqualTo("18:00");
        assertThat(first.getEndTime()).isEqualTo("20:00");
        assertThat(first.getCourtName()).isEqualTo("Sân 1");
        assertThat(result.getSessions().get(1).getStartTime()).isEqualTo("06:00");
        assertThat(result.getStartDate()).isEqualTo(DEC_1);
        assertThat(result.getEndDate()).isEqualTo(LocalDate.of(2026, 12, 29));
        assertThat(result.getLocationName()).isEqualTo("Cầu lông A");
        verify(bookingService).requireOwnTeam(PLAYER, null);
    }

    @Test
    void recurringTwoSlotsSameDayAreTwoSessions() {
        PackagePreviewResponse result = service.preview(player,
                recurring(DEC_1, DEC_31, new WeeklySlot(2, 1200, 1260), TUESDAY_EVENING), NOW);

        assertThat(result.getTotalSessions()).isEqualTo(10);
        assertThat(result.getSessions().get(0).getStartTime()).isEqualTo("18:00");
        assertThat(result.getSessions().get(1).getStartTime()).isEqualTo("20:00");
    }

    @Test
    void recurringLengthCountsLastDay() {
        assertThat(PackageService.isWithinMonths(DEC_1, DEC_31)).isTrue();
        assertThat(PackageService.isWithinMonths(DEC_1, LocalDate.of(2026, 12, 30))).isFalse();
        assertThat(PackageService.isWithinMonths(DEC_1, LocalDate.of(2027, 2, 28))).isTrue();
        assertThat(PackageService.isWithinMonths(DEC_1, LocalDate.of(2027, 3, 1))).isFalse();
        assertThat(PackageService.isWithinMonths(DEC_31, DEC_1)).isFalse();
    }

    @Test
    void recurringOutsideOneToThreeMonthsIsMsg41() {
        assertMsg41(recurring(DEC_1, LocalDate.of(2026, 12, 30), TUESDAY_EVENING));
        assertMsg41(recurring(DEC_1, LocalDate.of(2027, 3, 1), TUESDAY_EVENING));
        assertMsg41(recurring(DEC_1, DEC_31));
        assertMsg41(recurring(null, DEC_31, TUESDAY_EVENING));
    }

    @Test
    void recurringStartingBeforeTodayIsRejected() {
        assertThatThrownBy(() -> service.preview(player,
                recurring(LocalDate.of(2026, 11, 6), LocalDate.of(2026, 12, 31), TUESDAY_EVENING), NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("trước hôm nay");
    }

    @Test
    void recurringOverlappingSlotsOrBadMinutesAreRejected() {
        assertThatThrownBy(() -> service.preview(player,
                recurring(DEC_1, DEC_31, TUESDAY_EVENING, new WeeklySlot(2, 1140, 1260)), NOW))
                .isInstanceOf(AppException.class).hasMessageContaining("chồng giờ");
        assertThatThrownBy(() -> service.preview(player,
                recurring(DEC_1, DEC_31, new WeeklySlot(2, 1095, 1200)), NOW))
                .isInstanceOf(AppException.class).hasMessageContaining("30 phút");
        assertThatThrownBy(() -> service.preview(player,
                recurring(DEC_1, DEC_31, new WeeklySlot(2, 1200, 1200)), NOW))
                .isInstanceOf(AppException.class).hasMessageContaining("30 phút");
    }

    @Test
    void recurringForTeamNotCaptainIsForbidden() {
        doThrow(new AppException("Bạn chỉ đặt sân được cho đội mình làm chủ.", HttpStatus.FORBIDDEN))
                .when(bookingService).requireOwnTeam(PLAYER, 7L);
        PackageRequest request = new PackageRequest(PackageType.RECURRING, COURT, DEC_1, DEC_31,
                List.of(TUESDAY_EVENING), null, 7L, null, null, null);

        assertThatThrownBy(() -> service.preview(player, request, NOW))
                .extracting(e -> ((AppException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void unknownCourtIsNotFound() {
        when(courts.findByIdAndActiveTrue(COURT)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.preview(player, recurring(DEC_1, DEC_31, TUESDAY_EVENING), NOW))
                .extracting(e -> ((AppException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ===================== 12.3: tự chọn, đánh dấu buổi trùng =====================

    @Test
    void conflictsAreMarkedWithReasonAndSummarized() {
        when(availability.findProblem(LOCATION, COURT, LocalDate.of(2026, 12, 8), 1080, 1200))
                .thenReturn(Optional.of(SlotAvailabilityService.SlotProblem.TAKEN));
        when(availability.findProblem(LOCATION, COURT, LocalDate.of(2026, 12, 15), 1080, 1200))
                .thenReturn(Optional.of(SlotAvailabilityService.SlotProblem.MAINTENANCE));
        when(availability.findProblem(LOCATION, COURT, LocalDate.of(2027, 1, 5), 1080, 1200))
                .thenReturn(Optional.of(SlotAvailabilityService.SlotProblem.CLOSED));

        PackagePreviewResponse result = service.preview(player,
                recurring(DEC_1, LocalDate.of(2027, 1, 31), TUESDAY_EVENING), NOW);

        assertThat(result.getTotalSessions()).isEqualTo(9);
        assertThat(result.getConflictSessions()).isEqualTo(3);
        assertThat(result.getSummary()).isEqualTo("Tổng 9 buổi, 3 buổi bị trùng.");
        assertThat(result.getSessions()).extracting(PackagePreviewResponse.Session::getConflict).containsExactly(
                null, Conflict.TAKEN, Conflict.MAINTENANCE, null, null,
                Conflict.CLOSED, null, null, null);
        assertThat(result.getMonths()).extracting(PackagePreviewResponse.MonthSummary::getMonth,
                PackagePreviewResponse.MonthSummary::getTotalSessions,
                PackagePreviewResponse.MonthSummary::getConflictSessions)
                .containsExactly(tuple("2026-12", 5, 2), tuple("2027-01", 4, 1));
    }

    @Test
    void sessionTodayAlreadyStartedIsConflict() {
        PackagePreviewResponse result = service.preview(player, custom(
                session(TODAY, null, 480, 540), session(TODAY, null, 600, 660)), NOW);

        assertThat(result.getSessions()).extracting(PackagePreviewResponse.Session::getConflict)
                .containsExactly(Conflict.STARTED, null);
    }

    @Test
    void customSessionsSortedAndMayUseAnotherCourtOfSameLocation() {
        PackagePreviewResponse result = service.preview(player, custom(
                session(LocalDate.of(2026, 12, 20), 12L, 1080, 1140),
                session(DEC_1, null, 1200, 1320),
                session(DEC_1, null, 1080, 1140)), NOW);

        assertThat(result.getPackageType()).isEqualTo(PackageType.CUSTOM);
        assertThat(result.getSessions()).extracting(PackagePreviewResponse.Session::getDate,
                PackagePreviewResponse.Session::getStartTime, PackagePreviewResponse.Session::getCourtName)
                .containsExactly(tuple(DEC_1, "18:00", "Sân 1"), tuple(DEC_1, "20:00", "Sân 1"),
                        tuple(LocalDate.of(2026, 12, 20), "18:00", "Sân 2"));
        assertThat(result.getStartDate()).isEqualTo(DEC_1);
        assertThat(result.getEndDate()).isEqualTo(LocalDate.of(2026, 12, 20));
    }

    @Test
    void customNeedsTwoSessionsWithinThreeMonths() {
        assertThatThrownBy(() -> service.preview(player, custom(session(DEC_1, null, 1080, 1140)), NOW))
                .hasMessageContaining("(MSG91)");
        assertThatThrownBy(() -> service.preview(player,
                new PackageRequest(PackageType.CUSTOM, COURT, null, null, null, null, null, null, null, null), NOW))
                .hasMessageContaining("(MSG91)");
        assertThatThrownBy(() -> service.preview(player, custom(
                session(DEC_1, null, 1080, 1140), session(LocalDate.of(2027, 3, 1), null, 1080, 1140)), NOW))
                .hasMessageContaining("(MSG91)");
        assertThat(service.preview(player, custom(
                session(TODAY, null, 1080, 1140), session(LocalDate.of(2027, 2, 6), null, 1080, 1140)), NOW)
                .getTotalSessions()).isEqualTo(2);
    }

    @Test
    void everySessionWithinThreeMonthsFromToday() {
        // Hôm nay 07/11/2026: buổi xa nhất là 06/02/2027 (D162).
        assertThat(service.preview(player, custom(
                session(DEC_1, null, 1080, 1140), session(LocalDate.of(2027, 2, 6), null, 1080, 1140)), NOW)
                .getTotalSessions()).isEqualTo(2);
        assertThatThrownBy(() -> service.preview(player, custom(
                session(DEC_1, null, 1080, 1140), session(LocalDate.of(2027, 2, 7), null, 1080, 1140)), NOW))
                .hasMessage("Chỉ đặt được các buổi trong vòng 3 tháng kể từ hôm nay, muộn nhất ngày 06/02/2027. (MSG115)");
        // Định kỳ đủ dài (01/12–28/02) nhưng có buổi sau 06/02 thì bị chặn; định kỳ đủ 3 tháng phải bắt đầu hôm nay.
        assertThatThrownBy(() -> service.preview(player,
                recurring(DEC_1, LocalDate.of(2027, 2, 28), TUESDAY_EVENING), NOW))
                .hasMessageContaining("trong vòng 3 tháng kể từ hôm nay");
        assertThat(service.preview(player,
                recurring(TODAY, LocalDate.of(2027, 2, 6), TUESDAY_EVENING), NOW).getTotalSessions()).isEqualTo(13);
        // Slot bù của định kỳ cũng bị chặn theo cùng mốc.
        PackageRequest late = new PackageRequest(PackageType.RECURRING, COURT, LocalDate.of(2027, 1, 10),
                LocalDate.of(2027, 2, 9), List.of(TUESDAY_EVENING), null, null, null, null, null);
        assertThatThrownBy(() -> service.preview(player, late, NOW)).hasMessageContaining("muộn nhất ngày 06/02/2027");
    }

    @Test
    void customRejectsPastDaysOverlapsAndForeignCourts() {
        assertThatThrownBy(() -> service.preview(player, custom(
                session(TODAY.minusDays(1), null, 1080, 1140), session(DEC_1, null, 1080, 1140)), NOW))
                .hasMessageContaining("đã qua");
        assertThatThrownBy(() -> service.preview(player, custom(
                session(DEC_1, null, 1080, 1200), session(DEC_1, null, 1140, 1260)), NOW))
                .hasMessageContaining("chồng giờ");
        when(courts.findByIdAndActiveTrue(99L))
                .thenReturn(Optional.of(Court.builder().id(99L).locationId(2L).name("Sân khác").build()));
        assertThatThrownBy(() -> service.preview(player, custom(
                session(DEC_1, 99L, 1080, 1140), session(DEC_31, null, 1080, 1140)), NOW))
                .hasMessageContaining("không thuộc địa điểm");
        // Cùng giờ nhưng khác sân thì không chồng.
        assertThat(service.preview(player, custom(
                session(DEC_1, null, 1080, 1200), session(DEC_1, 12L, 1080, 1200)), NOW)
                .getTotalSessions()).isEqualTo(2);
    }

    @Test
    void recurringWithHandledSessionsKeepsPatternCheckAndPeriod() {
        List<PackageRequest.Session> handled = List.of(session(DEC_1, null, 1080, 1200),
                session(LocalDate.of(2026, 12, 9), 12L, 1080, 1200));
        PackageRequest ok = new PackageRequest(PackageType.RECURRING, COURT, DEC_1, DEC_31,
                List.of(TUESDAY_EVENING), handled, null, null, null, null);
        assertThat(service.preview(player, ok, NOW).getTotalSessions()).isEqualTo(2);

        PackageRequest outside = new PackageRequest(PackageType.RECURRING, COURT, DEC_1, DEC_31,
                List.of(TUESDAY_EVENING), List.of(session(DEC_1, null, 1080, 1200),
                        session(LocalDate.of(2027, 1, 5), null, 1080, 1200)), null, null, null, null);
        assertThatThrownBy(() -> service.preview(player, outside, NOW)).hasMessageContaining("ngoài thời gian");

        PackageRequest badPattern = new PackageRequest(PackageType.RECURRING, COURT, DEC_1,
                LocalDate.of(2026, 12, 20), List.of(TUESDAY_EVENING), handled, null, null, null, null);
        assertThatThrownBy(() -> service.preview(player, badPattern, NOW)).hasMessageContaining("(MSG41)");

        PackageRequest allDropped = new PackageRequest(PackageType.RECURRING, COURT, DEC_1, DEC_31,
                List.of(TUESDAY_EVENING), List.of(), null, null, null, null);
        assertThatThrownBy(() -> service.preview(player, allDropped, NOW)).hasMessageContaining("(MSG92)");
    }

    // ===================== 12.4: tổng tiền, chia giảm giá cho từng buổi =====================

    @Test
    void totalsCountOnlyBookableSessions() {
        when(availability.findProblem(LOCATION, COURT, LocalDate.of(2026, 12, 8), 1080, 1200))
                .thenReturn(Optional.of(SlotAvailabilityService.SlotProblem.TAKEN));

        PackagePreviewResponse result = service.preview(player, recurring(DEC_1, DEC_31, TUESDAY_EVENING), NOW);

        // 5 buổi thứ Ba, 1 buổi bị trùng; mỗi buổi 4 slot × 60.000.
        assertThat(result.getListAmount()).isEqualByComparingTo("960000");
        assertThat(result.getFinalAmount()).isEqualByComparingTo("960000");
        assertThat(result.getVoucherDiscount()).isEqualByComparingTo("0");
        assertThat(result.getSessions().get(1).getListAmount()).isNull();
        assertThat(result.getSessions().get(0).getListAmount()).isEqualByComparingTo("240000");
        assertThat(result.getSessions().get(0).getFinalAmount()).isEqualByComparingTo("240000");
        assertThat(result.getBatchOffer()).isNull();
        verifyNoInteractions(voucherService, points);
    }

    @Test
    void voucherAndPointsSplitByPriceRemainderOnLastSession() {
        // Buổi 1: 2 slot sân 1 = 120.000; buổi 2: 2 slot sân 2 = 160.000; buổi 3: 1 slot sân 1 = 60.000. Tổng 340.000.
        PackageRequest request = withDiscounts(custom(
                session(DEC_1, null, 1080, 1140),
                session(LocalDate.of(2026, 12, 2), 12L, 1080, 1140),
                session(LocalDate.of(2026, 12, 3), null, 1080, 1110)), "SALE", 101);
        voucherGives("100000");
        when(points.preview(PLAYER, LOCATION, new BigDecimal("240000"), 101)).thenReturn(new BigDecimal("50500"));

        PackagePreviewResponse result = service.preview(player, request, NOW);

        assertThat(result.getListAmount()).isEqualByComparingTo("340000");
        assertThat(result.getVoucherDiscount()).isEqualByComparingTo("100000");
        assertThat(result.getPointsUsed()).isEqualTo(101);
        assertThat(result.getPointDiscount()).isEqualByComparingTo("50500");
        assertThat(result.getFinalAmount()).isEqualByComparingTo("189500");
        // Voucher: 100.000 × 120/340 = 35.294; × 160/340 = 47.058; buổi cuối 17.648.
        assertThat(result.getSessions()).extracting(s -> s.getVoucherDiscount().intValue())
                .containsExactly(35294, 47058, 17648);
        // Điểm: 101 × 120/340 = 35; × 160/340 = 47; buổi cuối 19.
        assertThat(result.getSessions()).extracting(PackagePreviewResponse.Session::getPointsUsed)
                .containsExactly(35, 47, 19);
        assertThat(result.getSessions()).extracting(s -> s.getPointDiscount().intValue())
                .containsExactly(17500, 23500, 9500);
        BigDecimal sumFinal = result.getSessions().stream().map(PackagePreviewResponse.Session::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(sumFinal).isEqualByComparingTo(result.getFinalAmount());
    }

    @Test
    void allocationRefusesSessionLeftWithNothingToPay() {
        List<PackageService.Priced> priced = List.of(
                pricedSession(DEC_1, "300000"), pricedSession(LocalDate.of(2026, 12, 2), "1000"));
        // Voucher 290.000 chia 290.000 × 300/301 = 289.036 cho buổi 1; buổi cuối nhận 964 < 1.000 nên còn 36;
        // 3 điểm (1.500 đồng) chia 2 điểm cho buổi 1, buổi cuối nhận 1 điểm = 500 đồng > 36.
        assertThatThrownBy(() -> PackageService.allocate(priced, new BigDecimal("290000"), 3, new BigDecimal("1500")))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("2026-12-02");
    }

    @Test
    void voucherNotUsableIsMsg34() {
        when(voucherService.check(eq(player), any(VoucherCheckRequest.class)))
                .thenThrow(new AppException("Voucher hết lượt"));

        assertThatThrownBy(() -> service.preview(player,
                withDiscounts(recurring(DEC_1, DEC_31, TUESDAY_EVENING), "SALE", null), NOW))
                .hasMessageContaining("Voucher hết lượt").hasMessageContaining("(MSG34)");
    }

    @Test
    void batchOfferNotReachedShowsMsg93() {
        BatchOffer bigOffer = offer(1, TODAY.minusDays(1), TODAY.plusDays(30), 10);
        bigOffer.setMinPackageAmount(new BigDecimal("1500000"));
        when(offers.findAllByLocationIdOrderByStartDateDescIdDesc(LOCATION)).thenReturn(List.of(bigOffer));
        when(vouchers.findAllById(anyList())).thenReturn(List.of(voucher(10, VoucherStatus.PUBLISHED)));

        PackagePreviewResponse small = service.preview(player, recurring(DEC_1, DEC_31, TUESDAY_EVENING), NOW);
        assertThat(small.getBatchOffer().getId()).isEqualTo(1L);
        assertThat(small.getBatchOffer().isReached()).isFalse();
        assertThat(small.getBatchOffer().getMessage()).isEqualTo(
                "Gói có tổng 1.200.000 đồng, chưa đủ 1.500.000 đồng để được tặng voucher của chương trình Chương trình 1.");
    }

    @Test
    void batchOfferReachedOnAmountAfterDiscounts() {
        when(offers.findAllByLocationIdOrderByStartDateDescIdDesc(LOCATION))
                .thenReturn(List.of(offer(1, TODAY.minusDays(1), TODAY.plusDays(30), 10)));
        when(vouchers.findAllById(anyList())).thenReturn(List.of(voucher(10, VoucherStatus.PUBLISHED)));

        PackagePreviewResponse enough = service.preview(player, recurring(DEC_1, DEC_31, TUESDAY_EVENING), NOW);
        voucherGives("200001");
        PackagePreviewResponse belowAfterVoucher = service.preview(player,
                withDiscounts(recurring(DEC_1, DEC_31, TUESDAY_EVENING), "SALE", null), NOW);

        assertThat(enough.getBatchOffer().isReached()).isTrue();
        assertThat(enough.getBatchOffer().getMessage()).isNull();
        assertThat(belowAfterVoucher.getFinalAmount()).isEqualByComparingTo("999999");
        assertThat(belowAfterVoucher.getBatchOffer().isReached()).isFalse();
    }

    // ===================== 12.5: tạo gói, giữ chỗ 15 phút =====================

    /** Ba buổi tự chọn: 120.000 (sân 1), 160.000 (sân 2), 60.000 (sân 1). */
    private PackageRequest threeSessions(String code, Integer pointsToUse) {
        return withDiscounts(custom(
                session(DEC_1, null, 1080, 1140),
                session(LocalDate.of(2026, 12, 2), 12L, 1080, 1140),
                session(LocalDate.of(2026, 12, 3), null, 1080, 1110)), code, pointsToUse);
    }

    @Test
    void createSavesHoldingPackageAndSessionsHeldFifteenMinutes() {
        LocalDateTime now = LocalDateTime.of(2026, 11, 7, 9, 0, 15, 700_000_000);

        PackageDetailResponse result = service.create(player, threeSessions(null, null), now);

        InOrder order = inOrder(bookingService, packages, bookings);
        order.verify(bookingService).requirePendingPaymentLimit(PLAYER, now);
        order.verify(packages).save(any(BookingPackage.class));
        assertThat(savedPackage.getStatus()).isEqualTo(BookingStatus.HOLDING);
        assertThat(savedPackage.getPackageType()).isEqualTo(PackageType.CUSTOM);
        assertThat(savedPackage.getCreatedAt()).isEqualTo(LocalDateTime.of(2026, 11, 7, 9, 0, 15));
        assertThat(savedPackage.getHoldExpiresAt()).isEqualTo(LocalDateTime.of(2026, 11, 7, 9, 15, 15));
        assertThat(savedPackage.getStartDate()).isEqualTo(DEC_1);
        assertThat(savedPackage.getEndDate()).isEqualTo(LocalDate.of(2026, 12, 3));
        assertThat(savedPackage.getListAmount()).isEqualByComparingTo("340000");
        assertThat(savedPackage.getFinalAmount()).isEqualByComparingTo("340000");
        assertThat(savedPackage.getBatchOfferId()).isNull();

        assertThat(savedBookings).hasSize(3);
        assertThat(savedBookings).allSatisfy(b -> {
            assertThat(b.getBookingType()).isEqualTo(BookingType.SESSION);
            assertThat(b.getPackageId()).isEqualTo(50L);
            assertThat(b.getPlayerId()).isEqualTo(PLAYER);
            assertThat(b.getStatus()).isEqualTo(BookingStatus.HOLDING);
            assertThat(b.getHoldExpiresAt()).isEqualTo(savedPackage.getHoldExpiresAt());
        });
        assertThat(savedBookings).extracting(Booking::getBookingCode).containsExactly("BK1", "BK2", "BK3");
        assertThat(savedBookings).extracting(Booking::getCourtId).containsExactly(COURT, 12L, COURT);
        assertThat(savedBookings).extracting(b -> b.getFinalAmount().intValue()).containsExactly(120000, 160000, 60000);
        verify(bookingService).saveSlots(eq(savedBookings.get(1)), argThat(slots -> slots.size() == 2
                && slots.get(0).getPrice().intValue() == 80000));
        verifyNoInteractions(voucherService, points);

        assertThat(result.getId()).isEqualTo(50L);
        assertThat(result.getSessions()).extracting(BookingListItem::getCourtName).containsExactly("Sân 1", "Sân 2", "Sân 1");
        verify(bookings).saveAllAndFlush(savedBookings);
        verify(packages).saveAndFlush(savedPackage);
    }

    @Test
    void createSplitsConsumedVoucherAndPointsOverSessions() {
        doAnswer(inv -> {
            savedPackage.setVoucherDiscount(new BigDecimal("100000"));
            savedPackage.setFinalAmount(new BigDecimal("240000"));
            return null;
        }).when(voucherService).consumeForPackage(eq(50L), any());
        doAnswer(inv -> {
            savedPackage.setPointsUsed(101);
            savedPackage.setPointDiscount(new BigDecimal("50500"));
            savedPackage.setFinalAmount(new BigDecimal("189500"));
            return new BigDecimal("50500");
        }).when(points).redeemForPackage(50L, 101);

        service.create(player, threeSessions("SALE", 101), NOW);

        InOrder order = inOrder(voucherService, points);
        order.verify(voucherService).consumeForPackage(50L, new VoucherSelection("SALE", null));
        order.verify(points).redeemForPackage(50L, 101);
        assertThat(savedBookings).extracting(b -> b.getVoucherDiscount().intValue()).containsExactly(35294, 47058, 17648);
        assertThat(savedBookings).extracting(Booking::getPointsUsed).containsExactly(35, 47, 19);
        assertThat(savedBookings).extracting(b -> b.getFinalAmount().intValue()).containsExactly(67206, 89442, 32852);
    }

    @Test
    void createRecordsBatchOfferOnlyWhenReached() {
        when(offers.findAllByLocationIdOrderByStartDateDescIdDesc(LOCATION))
                .thenReturn(List.of(offer(1, TODAY.minusDays(1), TODAY.plusDays(30), 10)));
        when(vouchers.findAllById(anyList())).thenReturn(List.of(voucher(10, VoucherStatus.PUBLISHED)));

        service.create(player, recurring(DEC_1, DEC_31, TUESDAY_EVENING), NOW);
        assertThat(savedPackage.getBatchOfferId()).isEqualTo(1L);

        service.create(player, threeSessions(null, null), NOW);
        assertThat(savedPackage.getBatchOfferId()).isNull();
    }

    @Test
    void createWithConflictReportsSessionsWithoutSaving() {
        when(availability.findProblem(LOCATION, 12L, LocalDate.of(2026, 12, 2), 1080, 1140))
                .thenReturn(Optional.of(SlotAvailabilityService.SlotProblem.TAKEN));

        assertThatThrownBy(() -> service.create(player, threeSessions(null, null), NOW))
                .isInstanceOf(AppException.class)
                .hasMessage("Bạn có 1 buổi vừa bị đặt trùng: 02/12/2026 18:00–19:00 Sân 2. Các buổi này đã được "
                        + "đánh dấu trên lịch, vui lòng chọn slot bù hoặc bỏ buổi. (MSG44)")
                .extracting(e -> ((AppException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT);
        verify(packages, never()).save(any());
    }

    @Test
    void createWithSlotTakenWhileSavingIsMsg44() {
        doThrow(new AppException("Slot vừa có người giữ hoặc đặt. (MSG28)", HttpStatus.CONFLICT))
                .when(bookingService).saveSlots(argThat(b -> b != null && b.getCourtId().equals(12L)), anyList());

        assertThatThrownBy(() -> service.create(player, threeSessions(null, null), NOW))
                .hasMessageContaining("Bạn có 1 buổi vừa bị đặt trùng: 02/12/2026 18:00–19:00 Sân 2")
                .hasMessageContaining("(MSG44)");
    }

    @Test
    void createNeedsTwoSessionsAfterHandlingConflicts() {
        PackageRequest one = new PackageRequest(PackageType.RECURRING, COURT, DEC_1, DEC_31,
                List.of(TUESDAY_EVENING), List.of(session(DEC_1, null, 1080, 1200)), null, null, null, null);

        assertThatThrownBy(() -> service.create(player, one, NOW)).hasMessageContaining("(MSG92)");
        verify(packages, never()).save(any());
    }

    @Test
    void createStopsAtPendingPaymentLimit() {
        doThrow(new AppException("Bạn đang có 2 booking chờ thanh toán. (MSG29)", HttpStatus.CONFLICT))
                .when(bookingService).requirePendingPaymentLimit(PLAYER, NOW);

        assertThatThrownBy(() -> service.create(player, threeSessions(null, null), NOW)).hasMessageContaining("(MSG29)");
        verify(packages, never()).save(any());
    }

    @Test
    void createVoucherNoLongerUsableIsMsg108() {
        doThrow(new AppException("Voucher hết lượt")).when(voucherService).consumeForPackage(eq(50L), any());

        assertThatThrownBy(() -> service.create(player, threeSessions("SALE", null), NOW))
                .hasMessage("Mã giảm giá không còn dùng được: Voucher hết lượt. Vui lòng kiểm tra lại. (MSG108)");
    }

    @Test
    void expireHoldExpiresPackageSessionsAndReturnsDiscounts() {
        BookingPackage pkg = BookingPackage.builder().id(50L).playerId(PLAYER).status(BookingStatus.HOLDING)
                .startDate(DEC_1).endDate(DEC_31).holdExpiresAt(NOW.minusSeconds(1)).build();
        Booking s1 = Booking.builder().id(101L).packageId(50L).status(BookingStatus.HOLDING).build();
        Booking s2 = Booking.builder().id(102L).packageId(50L).status(BookingStatus.HOLDING).build();
        when(packages.findByIdForUpdate(50L)).thenReturn(Optional.of(pkg));
        when(bookings.findByPackageIdOrderByPlayDateAscStartMinuteAscIdAsc(50L)).thenReturn(List.of(s1, s2));

        assertThat(service.expireHold(50L, NOW)).isTrue();

        assertThat(pkg.getStatus()).isEqualTo(BookingStatus.EXPIRED);
        InOrder order = inOrder(packages, bookingService, voucherService, points);
        order.verify(packages).saveAndFlush(pkg);
        order.verify(bookingService).changeStatus(s1, BookingStatus.EXPIRED);
        order.verify(bookingService).releaseSlots(101L);
        order.verify(bookingService).changeStatus(s2, BookingStatus.EXPIRED);
        order.verify(bookingService).releaseSlots(102L);
        order.verify(voucherService).restoreForFailedPackage(50L);
        order.verify(points).restoreForFailedPackage(50L);
        verify(notifications).notifyOnce(eq(PLAYER), eq("BOOKING_HOLD_EXPIRED"), anyString(),
                eq("Gói đặt nhiều buổi từ 01/12/2026 đến 31/12/2026 đã bị hủy vì quá hạn thanh toán. Các slot đã được nhả."),
                eq("PACKAGE"), eq(50L));
    }

    @Test
    void expireHoldSkipsPackageAlreadyReportedOrStillHeld() {
        BookingPackage reported = BookingPackage.builder().id(50L).status(BookingStatus.AWAITING_CONFIRMATION)
                .holdExpiresAt(NOW.minusMinutes(1)).build();
        BookingPackage stillHeld = BookingPackage.builder().id(51L).status(BookingStatus.HOLDING)
                .holdExpiresAt(NOW.plusSeconds(1)).build();
        when(packages.findByIdForUpdate(50L)).thenReturn(Optional.of(reported));
        when(packages.findByIdForUpdate(51L)).thenReturn(Optional.of(stillHeld));

        assertThat(service.expireHold(50L, NOW)).isFalse();
        assertThat(service.expireHold(51L, NOW)).isFalse();
        verifyNoInteractions(bookingService, voucherService, points, notifications);
    }

    // ===================== 12.6: dùng cho thanh toán gói =====================

    @Test
    void changeStatusMovesPackageAndEverySession() {
        BookingPackage pkg = BookingPackage.builder().id(50L).status(BookingStatus.HOLDING).build();
        Booking s1 = Booking.builder().id(101L).build();
        Booking s2 = Booking.builder().id(102L).build();
        when(bookings.findByPackageIdOrderByPlayDateAscStartMinuteAscIdAsc(50L)).thenReturn(List.of(s1, s2));

        service.changeStatus(pkg, BookingStatus.AWAITING_CONFIRMATION);

        assertThat(pkg.getStatus()).isEqualTo(BookingStatus.AWAITING_CONFIRMATION);
        verify(packages).saveAndFlush(pkg);
        verify(bookingService).changeStatus(s1, BookingStatus.AWAITING_CONFIRMATION);
        verify(bookingService).changeStatus(s2, BookingStatus.AWAITING_CONFIRMATION);
    }

    @Test
    void packageOfAnotherPlayerIsForbiddenAndFirstSessionEndIsDeadline() {
        when(packages.findById(50L)).thenReturn(Optional.of(BookingPackage.builder().id(50L).playerId(99L).build()));
        when(bookings.findByPackageIdOrderByPlayDateAscStartMinuteAscIdAsc(50L)).thenReturn(List.of(
                Booking.builder().playDate(DEC_1).startMinute(1380).endMinute(1440).build(),
                Booking.builder().playDate(DEC_31).startMinute(360).endMinute(420).build()));

        assertThatThrownBy(() -> service.getForPlayer(50L, PLAYER))
                .extracting(e -> ((AppException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(service.firstSessionEnd(50L)).isEqualTo(LocalDateTime.of(2026, 12, 2, 0, 0));
    }

    // ===================== 12.7: tặng voucher theo lô khi xác nhận thanh toán gói =====================

    @Test
    void batchVoucherGrantedOnlyForPackageThatReachedOffer() {
        BookingPackage none = BookingPackage.builder().id(50L).playerId(PLAYER).build();
        assertThat(service.grantBatchOfferVoucher(none)).isFalse();
        verifyNoInteractions(voucherService, notifications);

        BookingPackage reached = BookingPackage.builder().id(51L).playerId(PLAYER).batchOfferId(1L).build();
        when(offers.findById(1L)).thenReturn(Optional.of(offer(1, TODAY, TODAY.plusDays(5), 10)));
        when(voucherService.grantForBatchOffer(10L, PLAYER, "Ưu đãi đặt theo lô: Chương trình 1 (gói #51)"))
                .thenReturn(true);

        assertThat(service.grantBatchOfferVoucher(reached)).isTrue();
        verify(notifications).notifyOnce(eq(PLAYER), eq("BATCH_OFFER_VOUCHER"), anyString(), anyString(),
                eq("PACKAGE"), eq(51L));
    }

    @Test
    void batchVoucherNotGrantableSendsNothing() {
        BookingPackage reached = BookingPackage.builder().id(51L).playerId(PLAYER).batchOfferId(1L).build();
        when(offers.findById(1L)).thenReturn(Optional.of(offer(1, TODAY, TODAY.plusDays(5), 10)));
        when(voucherService.grantForBatchOffer(eq(10L), eq(PLAYER), anyString())).thenReturn(false);

        assertThat(service.grantBatchOfferVoucher(reached)).isFalse();
        verifyNoInteractions(notifications);
    }

    private PackageService.Priced pricedSession(LocalDate date, String amount) {
        return new PackageService.Priced(new PackageService.Planned(date, court, 1080, 1110), List.of(),
                new BigDecimal(amount), BigDecimal.ZERO, 0, BigDecimal.ZERO);
    }

    private void assertMsg41(PackageRequest request) {
        assertThatThrownBy(() -> service.preview(player, request, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("(MSG41)");
    }
}
