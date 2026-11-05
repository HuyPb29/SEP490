package com.sep490.bms.service.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.sep490.bms.dto.payment.ReconciliationSummaryResponse;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.payment.ConfirmedPaymentTotal;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;

/** UC20: Staff đối soát doanh thu cuối ngày, Owner xem kết quả. */
class ReconciliationServiceTests {

    private static final Long LOCATION = 1L;
    private static final Long OWNER = 3L;
    private static final Long STAFF = 5L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 5);

    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final LocationAccessService access = mock(LocationAccessService.class);
    private final ReconciliationService service = new ReconciliationService(payments, access);

    private final UserPrincipal staff = UserPrincipal.builder().id(STAFF).role(Role.STAFF).locationId(LOCATION).build();
    private final Location location = Location.builder().id(LOCATION).ownerId(OWNER).status("ACTIVE").build();

    @BeforeEach
    void defaults() {
        when(access.selectedLocation(any())).thenReturn(location);
        when(payments.sumByConfirmedAt(any(), any(), any(), any()))
                .thenReturn(new ConfirmedPaymentTotal(0, BigDecimal.ZERO, BigDecimal.ZERO));
    }

    private void confirmedOn(LocalDate day, long count, String due, String received) {
        when(payments.sumByConfirmedAt(LOCATION, PaymentStatus.CONFIRMED,
                day.atStartOfDay(), day.plusDays(1).atStartOfDay()))
                .thenReturn(new ConfirmedPaymentTotal(count, new BigDecimal(due), new BigDecimal(received)));
    }

    // ---------- #1: tổng giao dịch đã xác nhận trong ngày ----------

    @Test
    void summaryAddsConfirmedPaymentsOfTheDayAndShowsOverpaymentSeparately() {
        confirmedOn(TODAY, 3, "330000", "380000");

        ReconciliationSummaryResponse result = service.getDaySummary(staff, null, TODAY);

        assertThat(result.getLocationId()).isEqualTo(LOCATION);
        assertThat(result.getDate()).isEqualTo(TODAY);
        assertThat(result.getConfirmedCount()).isEqualTo(3);
        assertThat(result.getSystemAmount()).isEqualByComparingTo("330000");
        assertThat(result.getOverpaidAmount()).isEqualByComparingTo("50000");
        verify(payments).sumByConfirmedAt(LOCATION, PaymentStatus.CONFIRMED,
                LocalDateTime.of(2026, 11, 5, 0, 0), LocalDateTime.of(2026, 11, 6, 0, 0));
    }

    @Test
    void summaryOfAnEarlierDayUsesThatDay() {
        LocalDate yesterday = TODAY.minusDays(1);
        confirmedOn(yesterday, 1, "110000", "110000");

        ReconciliationSummaryResponse result = service.getDaySummary(staff, yesterday, TODAY);

        assertThat(result.getDate()).isEqualTo(yesterday);
        assertThat(result.getSystemAmount()).isEqualByComparingTo("110000");
        assertThat(result.getOverpaidAmount()).isEqualByComparingTo("0");
    }

    @Test
    void summaryOfADayWithoutPaymentsIsZero() {
        ReconciliationSummaryResponse result = service.getDaySummary(staff, TODAY, TODAY);

        assertThat(result.getConfirmedCount()).isZero();
        assertThat(result.getSystemAmount()).isEqualByComparingTo("0");
        assertThat(result.getOverpaidAmount()).isEqualByComparingTo("0");
    }

    @Test
    void summaryOfAFutureDayIsRejected() {
        assertThatThrownBy(() -> service.getDaySummary(staff, TODAY.plusDays(1), TODAY))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("ngày chưa đến");
        verifyNoInteractions(payments);
    }

    @Test
    void totalWithoutRowsTurnsNullSumsIntoZero() {
        ConfirmedPaymentTotal total = new ConfirmedPaymentTotal(Long.valueOf(0), null, null);

        assertThat(total.amountDue()).isEqualByComparingTo("0");
        assertThat(total.receivedAmount()).isEqualByComparingTo("0");
    }
}
