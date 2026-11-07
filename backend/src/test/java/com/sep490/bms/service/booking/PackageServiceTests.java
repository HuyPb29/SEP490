package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.sep490.bms.dto.booking.BatchOfferPublicResponse;
import com.sep490.bms.dto.booking.PackagePreviewResponse;
import com.sep490.bms.dto.booking.PackageRequest;
import com.sep490.bms.dto.booking.PackageRequest.WeeklySlot;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.enums.DiscountType;
import com.sep490.bms.entity.enums.PackageType;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.promotion.Voucher;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.BatchOfferRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.promotion.VoucherRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.location.LocationQueryService;

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
    private final PackageService service = new PackageService(locations, offers, vouchers, courts, bookingService);

    private final UserPrincipal player = UserPrincipal.builder().id(PLAYER).role(Role.PLAYER).build();
    private final Location location = Location.builder().id(LOCATION).name("Cầu lông A").build();
    private final Court court = Court.builder().id(COURT).locationId(LOCATION).name("Sân 1").build();

    @BeforeEach
    void defaults() {
        when(locations.findActive(LOCATION)).thenReturn(location);
        when(courts.findByIdAndActiveTrue(COURT)).thenReturn(Optional.of(court));
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
                slots.length == 0 ? null : List.of(slots), null);
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
                List.of(TUESDAY_EVENING), 7L);

        assertThatThrownBy(() -> service.preview(player, request, NOW))
                .extracting(e -> ((AppException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void unknownCourtIsNotFound() {
        when(courts.findByIdAndActiveTrue(COURT)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.preview(player, recurring(DEC_1, DEC_31, TUESDAY_EVENING), NOW))
                .extracting(e -> ((AppException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    private void assertMsg41(PackageRequest request) {
        assertThatThrownBy(() -> service.preview(player, request, NOW))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("(MSG41)");
    }
}
