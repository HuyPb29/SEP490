package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;

import org.mockito.InOrder;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import com.sep490.bms.dto.booking.BookingSummaryResponse;
import com.sep490.bms.dto.promotion.VoucherCheckRequest;
import com.sep490.bms.dto.promotion.VoucherCheckResponse;
import com.sep490.bms.dto.promotion.VoucherSelection;
import com.sep490.bms.dto.request.BookingRequest;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.dto.booking.BookingResponse;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.booking.BookingSlot;
import com.sep490.bms.entity.enums.BookingStatus;
import com.sep490.bms.entity.enums.BookingType;
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

class BookingServiceTests {

    private static final Long LOCATION = 1L;
    private static final Long COURT = 5L;
    private static final Long PLAYER = 7L;
    private static final Long TEAM = 1L;
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 30);
    /** Hôm nay 12:10, giữa slot 12:00. */
    private static final LocalDateTime NOW = TODAY.atTime(12, 10);
    private static final LocalDate PLAY_DATE = TODAY.plusDays(3);
    /** 18:00–19:00: hai slot, giá khác nhau để thấy tổng tiền cộng từng slot. */
    private static final int START = 1080;
    private static final BigDecimal LIST_AMOUNT = new BigDecimal("130000");

    private final CourtRepository courts = mock(CourtRepository.class);
    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final SlotAvailabilityService availability = mock(SlotAvailabilityService.class);
    private final PriceCalculator prices = mock(PriceCalculator.class);
    private final VoucherService vouchers = mock(VoucherService.class);
    private final LoyaltyPointService points = mock(LoyaltyPointService.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final BookingRepository bookings = mock(BookingRepository.class);
    private final BookingSlotRepository bookingSlots = mock(BookingSlotRepository.class);
    private final BookingCodeGenerator codes = mock(BookingCodeGenerator.class);
    private final BookingPackageRepository packages = mock(BookingPackageRepository.class);
    private final TeamService teams = mock(TeamService.class);
    private final BookingService service = new BookingService(courts, locations, availability, prices, vouchers,
            points, accounts, bookings, bookingSlots, codes, packages, teams);

    private final UserPrincipal player = UserPrincipal.builder().id(PLAYER).role(Role.PLAYER).build();

    @BeforeEach
    void defaults() {
        when(courts.findByIdAndActiveTrue(COURT)).thenReturn(Optional.of(
                Court.builder().id(COURT).locationId(LOCATION).name("Sân 1").build()));
        when(locations.findActive(LOCATION)).thenReturn(
                Location.builder().id(LOCATION).name("Cầu lông Sunrise").advanceBookingDays((short) 30).build());
        Account account = Account.builder().id(PLAYER).fullName("Nguyễn An").phone("0912345678").build();
        when(accounts.findById(PLAYER)).thenReturn(Optional.of(account));
        when(accounts.findByIdForUpdate(PLAYER)).thenReturn(Optional.of(account));
        Map<Integer, BigDecimal> slotPrices = new LinkedHashMap<>();
        slotPrices.put(1080, new BigDecimal("60000"));
        slotPrices.put(1110, new BigDecimal("70000"));
        when(prices.rangePrices(eq(COURT), any(), anyInt(), anyInt())).thenReturn(slotPrices);
        when(availability.findProblem(any(), any(), any(), anyInt(), anyInt())).thenReturn(Optional.empty());
    }

    @Test
    void summaryAddsUpListPriceOfEachSlot() {
        BookingSummaryResponse summary = service.previewSummary(player, request(), NOW);

        assertThat(summary.getListAmount()).isEqualByComparingTo("130000");
        assertThat(summary.getFinalAmount()).isEqualByComparingTo("130000");
        assertThat(summary.getVoucherDiscount()).isEqualByComparingTo("0");
        assertThat(summary.getPointDiscount()).isEqualByComparingTo("0");
        assertThat(summary.getSlots()).extracting(BookingSummaryResponse.SlotPrice::getTime)
                .containsExactly("18:00", "18:30");
    }

    @Test
    void summaryShowsLocationCourtAndBooker() {
        BookingSummaryResponse summary = service.previewSummary(player, request(), NOW);

        assertThat(summary.getLocationName()).isEqualTo("Cầu lông Sunrise");
        assertThat(summary.getCourtName()).isEqualTo("Sân 1");
        assertThat(summary.getStartTime()).isEqualTo("18:00");
        assertThat(summary.getEndTime()).isEqualTo("19:00");
        assertThat(summary.getBookerName()).isEqualTo("Nguyễn An");
        assertThat(summary.getBookerPhone()).isEqualTo("0912345678");
    }

    @Test
    void courtTurnedOffIsNotFound() {
        when(courts.findByIdAndActiveTrue(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.previewSummary(player, request(), NOW))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void slotAlreadyHeldIsConflictMsg28() {
        problem(SlotProblem.TAKEN);

        assertThatThrownBy(() -> service.previewSummary(player, request(), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getMessage()).contains("MSG28");
                });
    }

    @Test
    void closedOrMaintenanceSlotIsMsg31() {
        for (SlotProblem reason : List.of(SlotProblem.CLOSED, SlotProblem.MAINTENANCE)) {
            problem(reason);

            assertNotBookable(request());
        }
    }

    @Test
    void dateAtAdvanceLimitIsAllowedButOneDayLaterIsMsg31() {
        LocalDate limit = TODAY.plusDays(30);

        assertThat(service.previewSummary(player, requestOn(limit, START), NOW).getDate()).isEqualTo(limit);
        assertNotBookable(requestOn(limit.plusDays(1), START));
    }

    @Test
    void pastDateIsMsg31() {
        assertNotBookable(requestOn(TODAY.minusDays(1), START));
    }

    @Test
    void slotThatAlreadyStartedTodayIsMsg31() {
        assertNotBookable(requestOn(TODAY, 720));
        assertThat(service.previewSummary(player, requestOn(TODAY, 750), NOW).getDate()).isEqualTo(TODAY);
    }

    @Test
    void noVoucherDoesNotCallVoucherService() {
        service.previewSummary(player, request(), NOW);

        verifyNoInteractions(vouchers);
    }

    @Test
    void voucherCodeReducesFinalAmountAfterCheckingListAmount() {
        when(vouchers.check(any(), any())).thenReturn(
                new VoucherCheckResponse(9L, null, LIST_AMOUNT, new BigDecimal("30000"), new BigDecimal("100000")));

        BookingSummaryResponse summary = service.previewSummary(player, requestWithVoucher("SUMMER", null), NOW);

        assertThat(summary.getVoucherDiscount()).isEqualByComparingTo("30000");
        assertThat(summary.getFinalAmount()).isEqualByComparingTo("100000");
        ArgumentCaptor<VoucherCheckRequest> checked = ArgumentCaptor.forClass(VoucherCheckRequest.class);
        verify(vouchers).check(eq(player), checked.capture());
        assertThat(checked.getValue().locationId()).isEqualTo(LOCATION);
        assertThat(checked.getValue().orderAmount()).isEqualByComparingTo(LIST_AMOUNT);
        assertThat(checked.getValue().selection()).isEqualTo(new VoucherSelection("SUMMER", null));
    }

    @Test
    void grantedVoucherIsSelectedByGrantId() {
        when(vouchers.check(any(), any())).thenReturn(
                new VoucherCheckResponse(9L, 3L, LIST_AMOUNT, new BigDecimal("10000"), new BigDecimal("120000")));

        service.previewSummary(player, requestWithVoucher(null, 3L), NOW);

        ArgumentCaptor<VoucherCheckRequest> checked = ArgumentCaptor.forClass(VoucherCheckRequest.class);
        verify(vouchers).check(eq(player), checked.capture());
        assertThat(checked.getValue().selection()).isEqualTo(new VoucherSelection(null, 3L));
    }

    @Test
    void blankVoucherCodeMeansNoVoucher() {
        service.previewSummary(player, requestWithVoucher("  ", null), NOW);

        verifyNoInteractions(vouchers);
    }

    @Test
    void invalidVoucherIsMsg34WithReason() {
        when(vouchers.check(any(), any())).thenThrow(new AppException("Voucher hết lượt"));

        assertThatThrownBy(() -> service.previewSummary(player, requestWithVoucher("USEDUP", null), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getMessage()).isEqualTo("Mã giảm giá không dùng được: Voucher hết lượt (MSG34)");
                });
    }

    @Test
    void locationClosedWhileCheckingVoucherKeepsNotFound() {
        when(vouchers.check(any(), any())).thenThrow(new AppException("Địa điểm không hoạt động", HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> service.previewSummary(player, requestWithVoucher("SUMMER", null), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(e.getMessage()).doesNotContain("MSG34");
                });
    }

    @Test
    void noPointsDoesNotCallPointService() {
        service.previewSummary(player, requestWithPoints(null, null), NOW);
        service.previewSummary(player, requestWithPoints(null, 0), NOW);

        verifyNoInteractions(points);
    }

    @Test
    void pointsWithoutVoucherAreCheckedOnListAmount() {
        when(points.preview(PLAYER, LOCATION, LIST_AMOUNT, 40)).thenReturn(new BigDecimal("20000"));

        BookingSummaryResponse summary = service.previewSummary(player, requestWithPoints(null, 40), NOW);

        assertThat(summary.getPointDiscount()).isEqualByComparingTo("20000");
        assertThat(summary.getFinalAmount()).isEqualByComparingTo("110000");
    }

    @Test
    void pointsAreCheckedOnAmountAfterVoucher() {
        when(vouchers.check(any(), any())).thenReturn(
                new VoucherCheckResponse(9L, null, LIST_AMOUNT, new BigDecimal("30000"), new BigDecimal("100000")));
        when(points.preview(PLAYER, LOCATION, new BigDecimal("100000"), 40)).thenReturn(new BigDecimal("20000"));

        BookingSummaryResponse summary = service.previewSummary(player, requestWithPoints("SUMMER", 40), NOW);

        assertThat(summary.getVoucherDiscount()).isEqualByComparingTo("30000");
        assertThat(summary.getPointDiscount()).isEqualByComparingTo("20000");
        assertThat(summary.getFinalAmount()).isEqualByComparingTo("80000");
    }

    @Test
    void pointErrorKeepsItsOwnMessage() {
        when(points.preview(any(), any(), any(), anyInt())).thenThrow(new AppException("Vượt trần (MSG38)"));

        assertThatThrownBy(() -> service.previewSummary(player, requestWithPoints(null, 999), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getMessage()).isEqualTo("Vượt trần (MSG38)");
                    assertThat(e.getMessage()).doesNotContain("MSG34");
                });
    }

    // ---- UC14 #6–8: tạo booking giữ chỗ (5.1) ----

    @Test
    void createSavesHoldingBookingWithFiveMinuteHold() {
        stubSave();

        BookingResponse created = service.createSingleBooking(player, requestWithNote("  Mượn 2 vợt  "),
                NOW.plusNanos(700_000_000));

        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookings).save(saved.capture());
        Booking booking = saved.getValue();
        assertThat(booking.getBookingType()).isEqualTo(BookingType.SINGLE);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.HOLDING);
        assertThat(booking.getPlayerId()).isEqualTo(PLAYER);
        assertThat(booking.getLocationId()).isEqualTo(LOCATION);
        assertThat(booking.getBookingCode()).isEqualTo("BK261030-ABCDEF");
        assertThat(booking.getNote()).isEqualTo("Mượn 2 vợt");
        assertThat(booking.getListAmount()).isEqualByComparingTo("130000");
        assertThat(booking.getFinalAmount()).isEqualByComparingTo("130000");
        // 12:10:00.7 + 5 phút, bỏ phần lẻ của giây.
        assertThat(booking.getHoldExpiresAt()).isEqualTo(TODAY.atTime(12, 15));
        assertThat(booking.getCreatedAt()).isEqualTo(TODAY.atTime(12, 10));
        assertThat(created.getId()).isEqualTo(100L);
        assertThat(created.getHoldExpiresAt()).isEqualTo(TODAY.atTime(12, 15));
    }

    @Test
    @SuppressWarnings("unchecked")
    void createSavesOneRowPerSlotWithListPrice() {
        stubSave();

        service.createSingleBooking(player, request(), NOW);

        ArgumentCaptor<List<BookingSlot>> saved = ArgumentCaptor.forClass(List.class);
        verify(bookingSlots).saveAllAndFlush(saved.capture());
        assertThat(saved.getValue()).extracting(BookingSlot::getSlotStartMinute).containsExactly(1080, 1110);
        assertThat(saved.getValue()).extracting(BookingSlot::getPrice)
                .usingComparatorForType(BigDecimal::compareTo, BigDecimal.class)
                .containsExactly(new BigDecimal("60000"), new BigDecimal("70000"));
        assertThat(saved.getValue()).allSatisfy(slot -> {
            assertThat(slot.getBookingId()).isEqualTo(100L);
            assertThat(slot.getCourtId()).isEqualTo(COURT);
            assertThat(slot.getSlotDate()).isEqualTo(PLAY_DATE);
            assertThat(slot.isActive()).isTrue();
        });
    }

    @Test
    void createBlankNoteIsStoredAsNull() {
        stubSave();

        service.createSingleBooking(player, requestWithNote("   "), NOW);

        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookings).save(saved.capture());
        assertThat(saved.getValue().getNote()).isNull();
    }

    @Test
    void createRechecksSlotAndSavesNothingWhenTaken() {
        problem(SlotProblem.TAKEN);

        assertThatThrownBy(() -> service.createSingleBooking(player, request(), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getMessage()).contains("MSG28"));
        verify(bookings, never()).save(any());
        verifyNoInteractions(bookingSlots, codes);
    }

    // ---- Trùng slot khi hai người cùng ghi: unique ux_slot_active (5.3) ----

    @Test
    void slotUniqueViolationBecomesMsg28() {
        stubSave();
        when(bookingSlots.saveAllAndFlush(any())).thenThrow(new DataIntegrityViolationException("could not execute",
                new SQLException("Cannot insert duplicate key row in object 'dbo.booking_slot' "
                        + "with unique index 'ux_slot_active'. The duplicate key value is (5, 2026-11-02, 1080).")));

        assertThatThrownBy(() -> service.createSingleBooking(player, request(), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getMessage()).contains("MSG28");
                });
        verifyNoInteractions(vouchers, points);
    }

    @Test
    void otherIntegrityViolationIsNotHidden() {
        stubSave();
        DataIntegrityViolationException other = new DataIntegrityViolationException("could not execute",
                new SQLException("The INSERT statement conflicted with the FOREIGN KEY constraint 'fk_slot_court'."));
        when(bookingSlots.saveAllAndFlush(any())).thenThrow(other);

        assertThatThrownBy(() -> service.createSingleBooking(player, request(), NOW)).isSameAs(other);
    }

    // ---- Trừ voucher và điểm khi tạo booking (5.4) ----

    @Test
    void createConsumesVoucherThenPointsAfterSavingSlots() {
        stubSave();

        service.createSingleBooking(player, requestWithPoints("SUMMER", 40), NOW);

        InOrder order = inOrder(bookings, bookingSlots, vouchers, points);
        order.verify(bookings).save(any(Booking.class));
        order.verify(bookingSlots).saveAllAndFlush(any());
        order.verify(vouchers).consumeForBooking(100L, new VoucherSelection("SUMMER", null));
        order.verify(points).redeemForBooking(100L, 40);
    }

    @Test
    void createSavesListPriceAndLetsDiscountsBeWrittenByPromotionServices() {
        stubSave();

        service.createSingleBooking(player, requestWithPoints("SUMMER", 40), NOW);

        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookings).save(saved.capture());
        assertThat(saved.getValue().getListAmount()).isEqualByComparingTo("130000");
        assertThat(saved.getValue().getVoucherDiscount()).isEqualByComparingTo("0");
        assertThat(saved.getValue().getPointDiscount()).isEqualByComparingTo("0");
        // Bước kiểm tra lại lúc Xác nhận không dùng hàm xem trước của màn tóm tắt cho voucher, điểm.
        verify(vouchers, never()).check(any(), any());
        verify(points, never()).preview(any(), any(), any(), anyInt());
    }

    @Test
    void grantedVoucherIsConsumedByGrantId() {
        stubSave();

        service.createSingleBooking(player, requestWithVoucher(null, 9L), NOW);

        verify(vouchers).consumeForBooking(100L, new VoucherSelection(null, 9L));
        verifyNoInteractions(points);
    }

    @Test
    void noVoucherNoPointsTouchesNeither() {
        stubSave();

        service.createSingleBooking(player, request(), NOW);

        verifyNoInteractions(vouchers, points);
    }

    @Test
    void voucherNoLongerUsableIsMsg108AndPointsAreNotUsed() {
        stubSave();
        when(vouchers.consumeForBooking(any(), any())).thenThrow(new AppException("Voucher hết lượt"));

        assertThatThrownBy(() -> service.createSingleBooking(player, requestWithPoints("SUMMER", 40), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getMessage()).isEqualTo(
                            "Mã giảm giá không còn dùng được: Voucher hết lượt. Vui lòng kiểm tra lại. (MSG108)");
                });
        verifyNoInteractions(points);
    }

    @Test
    void pointsNoLongerUsableIsMsg108WithoutOldCode() {
        stubSave();
        when(points.redeemForBooking(any(), anyInt())).thenThrow(
                new AppException("Bạn được dùng tối đa 50 điểm cho khoản thanh toán này. (MSG38)"));

        assertThatThrownBy(() -> service.createSingleBooking(player, requestWithPoints(null, 60), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getMessage()).isEqualTo(
                        "Số điểm không còn dùng được: Bạn được dùng tối đa 50 điểm cho khoản thanh toán này. "
                                + "Vui lòng kiểm tra lại. (MSG108)"));
    }

    @Test
    void promotionConflictIsKeptAsIs() {
        stubSave();
        AppException conflict = new AppException("Booking đã có lịch sử voucher", HttpStatus.CONFLICT);
        when(vouchers.consumeForBooking(any(), any())).thenThrow(conflict);

        assertThatThrownBy(() -> service.createSingleBooking(player, requestWithVoucher("SUMMER", null), NOW))
                .isSameAs(conflict);
    }

    private void stubSave() {
        when(codes.next()).thenReturn("BK261030-ABCDEF");
        when(bookings.save(any(Booking.class))).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            b.setId(100L);
            return b;
        });
    }

    // ---- BR35: tối đa 2 booking đang chờ thanh toán (5.2) ----

    @Test
    void thirdPendingSingleBookingIsRejectedMsg29() {
        when(bookings.countPendingPayment(PLAYER, NOW)).thenReturn(2L);

        assertThatThrownBy(() -> service.createSingleBooking(player, request(), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getMessage()).contains("MSG29").contains("Bạn đang có 2 booking");
                });
        verifyNoInteractions(bookingSlots, codes);
        verify(bookings, never()).save(any());
    }

    @Test
    void packageCountsTowardsTheLimit() {
        when(bookings.countPendingPayment(PLAYER, NOW)).thenReturn(1L);
        when(packages.countPendingPayment(PLAYER, NOW)).thenReturn(1L);

        assertThatThrownBy(() -> service.createSingleBooking(player, request(), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getMessage()).contains("MSG29"));
    }

    @Test
    void onePendingBookingStillAllowsAnother() {
        when(bookings.countPendingPayment(PLAYER, NOW)).thenReturn(1L);
        stubSave();

        BookingResponse created = service.createSingleBooking(player, request(), NOW);

        assertThat(created.getStatus()).isEqualTo(BookingStatus.HOLDING);
    }

    @Test
    void accountIsLockedBeforeCounting() {
        stubSave();

        service.createSingleBooking(player, request(), NOW);

        InOrder order = inOrder(accounts, bookings, packages);
        order.verify(accounts).findByIdForUpdate(PLAYER);
        order.verify(bookings).countPendingPayment(PLAYER, NOW);
        order.verify(packages).countPendingPayment(PLAYER, NOW);
    }

    // ---- FR37, BR09, DR03: đặt cho cá nhân hoặc cho đội mình làm chủ (5.5) ----

    @Test
    void personalBookingDoesNotCheckTeam() {
        stubSave();

        service.createSingleBooking(player, request(), NOW);

        verifyNoInteractions(teams);
        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookings).save(saved.capture());
        assertThat(saved.getValue().getTeamId()).isNull();
    }

    @Test
    void bookingForOwnTeamStoresTeamId() {
        when(teams.isCaptain(TEAM, PLAYER)).thenReturn(true);
        stubSave();

        service.createSingleBooking(player, requestForTeam(TEAM), NOW);

        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookings).save(saved.capture());
        assertThat(saved.getValue().getTeamId()).isEqualTo(TEAM);
    }

    @Test
    void summaryForTeamNotLedByPlayerIsForbidden() {
        when(teams.isCaptain(TEAM, PLAYER)).thenReturn(false);

        assertThatThrownBy(() -> service.previewSummary(player, requestForTeam(TEAM), NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(e.getMessage()).contains("đội mình làm chủ");
                });
    }

    @Test
    void createForTeamNotLedByPlayerSavesNothing() {
        when(teams.isCaptain(TEAM, PLAYER)).thenReturn(false);

        assertThatThrownBy(() -> service.createSingleBooking(player, requestForTeam(TEAM), NOW))
                .isInstanceOfSatisfying(AppException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        verify(bookings, never()).save(any());
        verifyNoInteractions(bookingSlots, codes, vouchers, points);
    }

    private static BookingRequest requestForTeam(Long teamId) {
        return new BookingRequest(COURT, PLAY_DATE, START, START + 60, null, null, 0, null, teamId);
    }

    private static BookingRequest requestWithNote(String note) {
        return new BookingRequest(COURT, PLAY_DATE, START, START + 60, null, null, 0, note, null);
    }

    @Test
    void playerReadsOwnBooking() {
        Booking own = Booking.builder().id(30L).playerId(PLAYER).build();
        when(bookings.findById(30L)).thenReturn(Optional.of(own));

        assertThat(service.getForPlayer(30L, PLAYER)).isSameAs(own);
    }

    @Test
    void bookingOfAnotherPlayerIsForbidden() {
        when(bookings.findById(30L)).thenReturn(Optional.of(Booking.builder().id(30L).playerId(8L).build()));

        assertThatThrownBy(() -> service.getForPlayer(30L, PLAYER))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void counterBookingWithoutPlayerIsForbidden() {
        when(bookings.findById(30L)).thenReturn(Optional.of(Booking.builder().id(30L).build()));

        assertThatThrownBy(() -> service.getForPlayer(30L, PLAYER))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void missingBookingIsNotFound() {
        when(bookings.findById(30L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getForPlayer(30L, PLAYER))
                .isInstanceOf(AppException.class)
                .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void lockForPaymentReadsWithRowLock() {
        Booking locked = Booking.builder().id(30L).playerId(PLAYER).build();
        when(bookings.findByIdForUpdate(30L)).thenReturn(Optional.of(locked));

        assertThat(service.lockForPayment(30L)).isSameAs(locked);
        verify(bookings, never()).findById(any());
    }

    @Test
    void changeStatusWritesImmediately() {
        Booking booking = Booking.builder().id(30L).status(BookingStatus.HOLDING).build();
        when(bookings.saveAndFlush(booking)).thenReturn(booking);

        service.changeStatus(booking, BookingStatus.AWAITING_CONFIRMATION);

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.AWAITING_CONFIRMATION);
        assertThat(booking.getUpdatedAt()).isNotNull();
        verify(bookings).saveAndFlush(booking);
    }

    private void assertNotBookable(BookingRequest request) {
        assertThatThrownBy(() -> service.previewSummary(player, request, NOW))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getMessage()).contains("MSG31").contains("30 ngày");
                });
    }

    private void problem(SlotProblem reason) {
        when(availability.findProblem(any(), any(), any(), anyInt(), anyInt())).thenReturn(Optional.of(reason));
    }

    private static BookingRequest request() {
        return requestOn(PLAY_DATE, START);
    }

    private static BookingRequest requestWithVoucher(String code, Long grantId) {
        return new BookingRequest(COURT, PLAY_DATE, START, START + 60, code, grantId, 0, null, null);
    }

    private static BookingRequest requestWithPoints(String voucherCode, Integer pointsToUse) {
        return new BookingRequest(COURT, PLAY_DATE, START, START + 60, voucherCode, null, pointsToUse, null, null);
    }

    private static BookingRequest requestOn(LocalDate date, int startMinute) {
        return new BookingRequest(COURT, date, startMinute, startMinute + 60, null, null, 0, null, null);
    }
}
