package com.sep490.bms.service.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.payment.ReconciliationRequest;
import com.sep490.bms.dto.payment.ReconciliationResponse;
import com.sep490.bms.dto.payment.ReconciliationSummaryResponse;
import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.entity.payment.Reconciliation;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.payment.ConfirmedPaymentTotal;
import com.sep490.bms.repository.payment.PaymentRepository;
import com.sep490.bms.repository.payment.ReconciliationRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;

/** UC20: Staff đối soát doanh thu cuối ngày, Owner xem kết quả. */
class ReconciliationServiceTests {

    private static final Long LOCATION = 1L;
    private static final Long OTHER_LOCATION = 2L;
    private static final Long OWNER = 3L;
    private static final Long STAFF = 5L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 5);
    private static final Long RECON = 40L;

    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final ReconciliationRepository reconciliations = mock(ReconciliationRepository.class);
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final LocationAccessService access = mock(LocationAccessService.class);
    private final ReconciliationService service = new ReconciliationService(payments, reconciliations, accounts, access);

    private final UserPrincipal staff = UserPrincipal.builder().id(STAFF).role(Role.STAFF).locationId(LOCATION).build();
    private final UserPrincipal owner = UserPrincipal.builder().id(OWNER).role(Role.OWNER).build();
    private final Location location = Location.builder().id(LOCATION).ownerId(OWNER).status("ACTIVE").build();

    @BeforeEach
    void defaults() {
        when(access.selectedLocation(any())).thenReturn(location);
        when(payments.sumByConfirmedAt(any(), any(), any(), any()))
                .thenReturn(new ConfirmedPaymentTotal(0, BigDecimal.ZERO, BigDecimal.ZERO));
        when(reconciliations.findByLocationIdAndReconDate(any(), any())).thenReturn(Optional.empty());
        when(reconciliations.saveAndFlush(any())).thenAnswer(call -> {
            Reconciliation saved = call.getArgument(0);
            saved.setId(RECON);
            saved.setCreatedAt(LocalDateTime.of(2026, 11, 5, 22, 30));
            return saved;
        });
        when(accounts.findById(STAFF)).thenReturn(Optional.of(Account.builder().id(STAFF).fullName("Lê Văn Staff").build()));
    }

    private Reconciliation savedOn(LocalDate day, Long locationId) {
        return Reconciliation.builder()
                .id(RECON)
                .locationId(locationId)
                .reconDate(day)
                .systemAmount(new BigDecimal("330000"))
                .actualAmount(new BigDecimal("380000"))
                .reason("Khách BK000030 chuyển thừa 50.000 đồng")
                .staffId(STAFF)
                .createdAt(LocalDateTime.of(2026, 11, 5, 22, 30))
                .build();
    }

    private static ReconciliationRequest request(LocalDate day, String actual, String reason) {
        return new ReconciliationRequest(day, new BigDecimal(actual), reason);
    }

    private static HttpStatus statusOf(Throwable error) {
        return ((AppException) error).getStatus();
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
        assertThat(result.getReconciliation()).isNull();
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
    void summaryOfAReconciledDayIncludesTheSavedResult() {
        when(reconciliations.findByLocationIdAndReconDate(LOCATION, TODAY)).thenReturn(Optional.of(savedOn(TODAY, LOCATION)));

        ReconciliationSummaryResponse result = service.getDaySummary(staff, TODAY, TODAY);

        assertThat(result.getReconciliation()).isNotNull();
        assertThat(result.getReconciliation().getDifference()).isEqualByComparingTo("50000");
        assertThat(result.getReconciliation().getStaffName()).isEqualTo("Lê Văn Staff");
    }

    // ---------- #2–#4: nhập số thực nhận, lý do khi lệch, lưu ----------

    @Test
    void matchingAmountIsSavedWithoutReasonUsingTheSystemTotalAtSaveTime() {
        confirmedOn(TODAY, 3, "330000", "330000");

        ReconciliationResponse result = service.submit(staff, request(TODAY, "330000", "   "), TODAY);

        ArgumentCaptor<Reconciliation> saved = ArgumentCaptor.forClass(Reconciliation.class);
        verify(reconciliations).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getLocationId()).isEqualTo(LOCATION);
        assertThat(saved.getValue().getReconDate()).isEqualTo(TODAY);
        assertThat(saved.getValue().getSystemAmount()).isEqualByComparingTo("330000");
        assertThat(saved.getValue().getActualAmount()).isEqualByComparingTo("330000");
        assertThat(saved.getValue().getReason()).isNull();
        assertThat(saved.getValue().getStaffId()).isEqualTo(STAFF);
        assertThat(result.getId()).isEqualTo(RECON);
        assertThat(result.getDifference()).isEqualByComparingTo("0");
        assertThat(result.getStaffName()).isEqualTo("Lê Văn Staff");
    }

    @Test
    void differenceWithReasonIsSaved() {
        confirmedOn(TODAY, 3, "330000", "380000");

        ReconciliationResponse result = service.submit(staff,
                request(TODAY, "380000", "  Khách BK000030 chuyển thừa 50.000 đồng "), TODAY);

        assertThat(result.getDifference()).isEqualByComparingTo("50000");
        assertThat(result.getReason()).isEqualTo("Khách BK000030 chuyển thừa 50.000 đồng");
    }

    @Test
    void differenceWithoutReasonIsRejectedWithMsg59() {
        confirmedOn(TODAY, 3, "330000", "330000");

        assertThatThrownBy(() -> service.submit(staff, request(TODAY, "310000", null), TODAY))
                .isInstanceOf(AppException.class)
                .hasMessage("Số tiền lệch -20.000 đồng. Vui lòng nhập lý do. (MSG59)");
        assertThatThrownBy(() -> service.submit(staff, request(TODAY, "1330000", ""), TODAY))
                .hasMessage("Số tiền lệch +1.000.000 đồng. Vui lòng nhập lý do. (MSG59)");
        verify(reconciliations, never()).saveAndFlush(any());
    }

    @Test
    void secondReconciliationOfTheSameDayIsRejected() {
        when(reconciliations.existsByLocationIdAndReconDate(LOCATION, TODAY)).thenReturn(true);

        assertThatThrownBy(() -> service.submit(staff, request(TODAY, "0", null), TODAY))
                .isInstanceOf(AppException.class)
                .hasMessage("Ngày 05/11/2026 đã được đối soát.")
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));
        verify(reconciliations, never()).saveAndFlush(any());
    }

    @Test
    void twoStaffSavingTheSameDayAtOnceGetConflictFromUniqueIndex() {
        doThrow(new DataIntegrityViolationException("x",
                new RuntimeException("Violation of UNIQUE KEY constraint 'ux_recon_day'"))).when(reconciliations).saveAndFlush(any());

        assertThatThrownBy(() -> service.submit(staff, request(TODAY, "0", null), TODAY))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void otherIntegrityErrorsAreNotHidden() {
        doThrow(new DataIntegrityViolationException("x",
                new RuntimeException("ck_recon_reason"))).when(reconciliations).saveAndFlush(any());

        assertThatThrownBy(() -> service.submit(staff, request(TODAY, "0", null), TODAY))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void earlierDayCanBeReconciledButFutureDayCannot() {
        LocalDate yesterday = TODAY.minusDays(1);
        confirmedOn(yesterday, 1, "110000", "110000");

        assertThat(service.submit(staff, request(yesterday, "110000", null), TODAY).getDate()).isEqualTo(yesterday);
        assertThatThrownBy(() -> service.submit(staff, request(TODAY.plusDays(1), "0", null), TODAY))
                .hasMessageContaining("ngày chưa đến");
    }

    // ---------- #4: xem lại một kết quả ----------

    @Test
    void getByIdReturnsResultOfOwnLocation() {
        when(reconciliations.findById(RECON)).thenReturn(Optional.of(savedOn(TODAY, LOCATION)));

        ReconciliationResponse result = service.getById(staff, RECON);

        assertThat(result.getSystemAmount()).isEqualByComparingTo("330000");
        assertThat(result.getActualAmount()).isEqualByComparingTo("380000");
        assertThat(result.getDifference()).isEqualByComparingTo("50000");
    }

    @Test
    void getByIdOfAnotherLocationIsForbiddenAndMissingIsNotFound() {
        when(reconciliations.findById(RECON)).thenReturn(Optional.of(savedOn(TODAY, OTHER_LOCATION)));
        when(reconciliations.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getById(staff, RECON))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> service.getById(staff, 99L))
                .satisfies(e -> assertThat(statusOf(e)).isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ---------- #5: Owner xem kết quả đối soát ----------

    @Test
    void ownerListsResultsOfSelectedLocationNewestFirstWithStaffNames() {
        Reconciliation today = savedOn(TODAY, LOCATION);
        Reconciliation yesterday = savedOn(TODAY.minusDays(1), LOCATION);
        yesterday.setId(39L);
        yesterday.setActualAmount(new BigDecimal("330000"));
        yesterday.setReason(null);
        LocalDate from = TODAY.minusDays(7);
        when(reconciliations.findForLocation(LOCATION, from, TODAY, PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(today, yesterday), PageRequest.of(0, 20), 2));
        when(accounts.findAllById(any())).thenReturn(List.of(Account.builder().id(STAFF).fullName("Lê Văn Staff").build()));

        PageResponse<ReconciliationResponse> result = service.listForOwner(owner, from, TODAY, 0, 20);

        assertThat(result.getTotalElements()).isEqualTo(2);
        assertThat(result.getContent()).extracting(ReconciliationResponse::getDate)
                .containsExactly(TODAY, TODAY.minusDays(1));
        assertThat(result.getContent()).extracting(ReconciliationResponse::getStaffName)
                .containsOnly("Lê Văn Staff");
        assertThat(result.getContent().get(0).getDifference()).isEqualByComparingTo("50000");
        assertThat(result.getContent().get(1).getDifference()).isEqualByComparingTo("0");
        verify(access).selectedLocation(owner);
    }

    @Test
    void ownerListWithoutDatesIsNotLimited() {
        when(reconciliations.findForLocation(LOCATION, null, null, PageRequest.of(1, 10)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(1, 10), 0));

        assertThat(service.listForOwner(owner, null, null, 1, 10).getContent()).isEmpty();
    }

    @Test
    void ownerListRejectsBadRangeAndPaging() {
        assertThatThrownBy(() -> service.listForOwner(owner, TODAY, TODAY.minusDays(1), 0, 20))
                .hasMessageContaining("Ngày bắt đầu");
        assertThatThrownBy(() -> service.listForOwner(owner, null, null, -1, 20))
                .hasMessage("Phân trang không hợp lệ");
        assertThatThrownBy(() -> service.listForOwner(owner, null, null, 0, 101))
                .hasMessage("Phân trang không hợp lệ");
        verifyNoInteractions(reconciliations);
    }

    @Test
    void totalWithoutRowsTurnsNullSumsIntoZero() {
        ConfirmedPaymentTotal total = new ConfirmedPaymentTotal(Long.valueOf(0), null, null);

        assertThat(total.amountDue()).isEqualByComparingTo("0");
        assertThat(total.receivedAmount()).isEqualByComparingTo("0");
    }
}
