package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.sep490.bms.dto.booking.BatchOfferPublicResponse;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.enums.DiscountType;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.promotion.Voucher;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.BatchOfferRepository;
import com.sep490.bms.repository.promotion.VoucherRepository;
import com.sep490.bms.service.location.LocationQueryService;

/** UC15: đặt nhiều buổi. */
class PackageServiceTests {

    private static final Long LOCATION = 1L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 7);

    private final LocationQueryService locations = mock(LocationQueryService.class);
    private final BatchOfferRepository offers = mock(BatchOfferRepository.class);
    private final VoucherRepository vouchers = mock(VoucherRepository.class);
    private final PackageService service = new PackageService(locations, offers, vouchers);

    private final Location location = Location.builder().id(LOCATION).name("Cầu lông A").build();

    private static BatchOffer offer(long id, LocalDate start, LocalDate end, long voucherId) {
        return BatchOffer.builder().id(id).locationId(LOCATION).name("Chương trình " + id)
                .startDate(start).endDate(end).minPackageAmount(new BigDecimal("1000000")).voucherId(voucherId).build();
    }

    private static Voucher voucher(long id, VoucherStatus status) {
        return Voucher.builder().id(id).locationId(LOCATION).name("Voucher " + id).code("SECRET" + id)
                .discountType(DiscountType.AMOUNT).discountValue(new BigDecimal("50000")).status(status).build();
    }

    // ===================== 12.1: chương trình theo lô công khai =====================

    @Test
    void batchOffersOnlyThoseRunningTodayWithPublishedVoucher() {
        when(locations.findActive(LOCATION)).thenReturn(location);
        BatchOffer running = offer(1, TODAY.minusDays(3), TODAY.plusDays(3), 10);
        BatchOffer startsToday = offer(2, TODAY, TODAY.plusDays(30), 11);
        BatchOffer endsToday = offer(3, TODAY.minusDays(30), TODAY, 12);
        BatchOffer future = offer(4, TODAY.plusDays(1), TODAY.plusDays(10), 13);
        BatchOffer past = offer(5, TODAY.minusDays(10), TODAY.minusDays(1), 14);
        BatchOffer disabledVoucher = offer(6, TODAY.minusDays(1), TODAY.plusDays(1), 15);
        when(offers.findAllByLocationIdOrderByStartDateDescIdDesc(LOCATION))
                .thenReturn(List.of(future, startsToday, disabledVoucher, running, endsToday, past));
        when(vouchers.findAllById(org.mockito.ArgumentMatchers.anyList())).thenReturn(List.of(
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
        when(locations.findActive(LOCATION)).thenReturn(location);
        when(offers.findAllByLocationIdOrderByStartDateDescIdDesc(LOCATION))
                .thenReturn(List.of(offer(5, TODAY.minusDays(10), TODAY.minusDays(1), 14)));

        assertThat(service.listActiveBatchOffers(LOCATION, TODAY)).isEmpty();
        org.mockito.Mockito.verifyNoInteractions(vouchers);
    }

    @Test
    void batchOffersOfLockedLocationIsNotFound() {
        when(locations.findActive(LOCATION)).thenThrow(new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> service.listActiveBatchOffers(LOCATION, TODAY))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
