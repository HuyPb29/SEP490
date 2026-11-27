package com.sep490.bms.service.promotion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.sep490.bms.dto.promotion.PersonalVoucherResponse;
import com.sep490.bms.dto.promotion.VoucherCheckRequest;
import com.sep490.bms.dto.promotion.VoucherCheckResponse;
import com.sep490.bms.dto.promotion.VoucherResponse;
import com.sep490.bms.dto.promotion.VoucherSelection;
import com.sep490.bms.dto.promotion.VoucherUpdateRequest;
import com.sep490.bms.dto.promotion.VoucherWriteRequest;
import com.sep490.bms.dto.request.VoucherGrantRequest;
import com.sep490.bms.entity.account.Account;
import com.sep490.bms.entity.account.AccountStatus;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.DiscountType;
import com.sep490.bms.entity.enums.VoucherGrantStatus;
import com.sep490.bms.entity.enums.VoucherSource;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.enums.VoucherTargetGroup;
import com.sep490.bms.entity.enums.VoucherUsageStatus;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.promotion.Voucher;
import com.sep490.bms.entity.promotion.VoucherGrant;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.repository.promotion.VoucherGrantRepository;
import com.sep490.bms.repository.promotion.VoucherRepository;
import com.sep490.bms.repository.promotion.VoucherUsageRepository;
import com.sep490.bms.security.LocationAccessService;
import com.sep490.bms.security.UserPrincipal;

import jakarta.persistence.EntityManager;

/**
 * Unit test thuần Mockito cho VoucherService (các hàm không chạm EntityManager).
 */
@ExtendWith(MockitoExtension.class)
class VoucherServiceUnitTests {

    private static final Long LOCATION_ID = 1L;
    private static final Long OWNER_ID = 10L;
    private static final Long PLAYER_ID = 7L;

    @Mock
    private VoucherRepository vouchers;

    @Mock
    private VoucherGrantRepository grants;

    @Mock
    private VoucherUsageRepository usages;

    @Mock
    private AccountRepository accounts;

    @Mock
    private LocationRepository locations;

    @Mock
    private LocationAccessService scope;

    @Mock
    private EntityManager em;

    @InjectMocks
    private VoucherService service;

    private static UserPrincipal owner() {
        return UserPrincipal.builder().id(OWNER_ID).role(Role.OWNER).build();
    }

    private static UserPrincipal player() {
        return UserPrincipal.builder().id(PLAYER_ID).role(Role.PLAYER).build();
    }

    private static Location activeLocation() {
        return Location.builder().id(LOCATION_ID).ownerId(OWNER_ID).status("ACTIVE").build();
    }

    private void stubActiveOwnerLocation(UserPrincipal ownerUser, Location location) {
        when(scope.selectedLocation(ownerUser)).thenReturn(location);
        when(locations.findById(location.getId())).thenReturn(Optional.of(location));
    }

    // Kiểm tra Owner tạo campaign mới chuẩn hóa mã chữ hoa, gán trạng thái DRAFT và cố định chính sách điểm P12/P13.
    @Test
    void create_validCampaign_normalizesCodeAndAppliesFixedPointPolicy() {
        // Arrange
        UserPrincipal ownerUser = owner();
        Location location = activeLocation();
        LocalDate today = LocalDate.now();
        VoucherWriteRequest request = new VoucherWriteRequest(
                "summer20", "  Ưu đãi hè  ", VoucherTargetGroup.ALL_PLAYERS,
                DiscountType.AMOUNT, new BigDecimal("20000"), new BigDecimal("100000"),
                today, today.plusDays(10), 7, 1, 50, new BigDecimal("1000000"));
        stubActiveOwnerLocation(ownerUser, location);
        when(vouchers.existsByLocationIdAndCode(LOCATION_ID, "SUMMER20")).thenReturn(false);
        when(vouchers.saveAndFlush(any(Voucher.class))).thenAnswer(inv -> {
            Voucher saved = inv.getArgument(0);
            saved.setId(99L);
            return saved;
        });

        // Act
        VoucherResponse response = service.create(ownerUser, request);

        // Assert
        assertThat(response.id()).isEqualTo(99L);
        assertThat(response.code()).isEqualTo("SUMMER20");
        assertThat(response.name()).isEqualTo("Ưu đãi hè");
        assertThat(response.source()).isEqualTo(VoucherSource.CAMPAIGN);
        assertThat(response.status()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(response.allowPoints()).isTrue();
        assertThat(response.maxPointPercent()).isEqualTo(50);
    }

    // Kiểm tra từ chối tạo voucher khi ngày hết hạn đã ở quá khứ và không ghi xuống repository.
    @Test
    void create_expiredValidTo_throwsBadRequestWithoutSaving() {
        // Arrange
        UserPrincipal ownerUser = owner();
        Location location = activeLocation();
        LocalDate today = LocalDate.now();
        VoucherWriteRequest request = new VoucherWriteRequest(
                "OLD20", "Voucher cũ", VoucherTargetGroup.ALL_PLAYERS,
                DiscountType.AMOUNT, new BigDecimal("20000"), new BigDecimal("100000"),
                today.minusDays(5), today.minusDays(1), null, 1, 10, new BigDecimal("200000"));
        stubActiveOwnerLocation(ownerUser, location);

        // Act & Assert
        assertThatThrownBy(() -> service.create(ownerUser, request))
                .isInstanceOfSatisfying(AppException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(ex.getMessage()).isEqualTo("Voucher đã hết hạn");
                });
        verify(vouchers, never()).saveAndFlush(any());
    }

    // Kiểm tra biên gia hạn campaign đã EXPIRED (UC37): cập nhật hạn mới hợp lệ và tự động kích hoạt lại sang PUBLISHED.
    @Test
    void update_expiredCampaignRenewed_reactivatesToPublished() {
        // Arrange
        UserPrincipal ownerUser = owner();
        Location location = activeLocation();
        LocalDate today = LocalDate.now();
        Voucher existing = Voucher.builder()
                .id(5L)
                .locationId(LOCATION_ID)
                .code("RENEW10")
                .name("Cũ")
                .source(VoucherSource.CAMPAIGN)
                .targetGroup(VoucherTargetGroup.ALL_PLAYERS)
                .discountType(DiscountType.AMOUNT)
                .discountValue(new BigDecimal("10000"))
                .minOrderAmount(BigDecimal.ZERO)
                .validFrom(today.minusDays(10))
                .validTo(today.minusDays(1))
                .status(VoucherStatus.EXPIRED)
                .version(1)
                .build();
        VoucherWriteRequest write = new VoucherWriteRequest(
                "renew10", "Gia hạn", VoucherTargetGroup.ALL_PLAYERS,
                DiscountType.AMOUNT, new BigDecimal("15000"), new BigDecimal("50000"),
                today, today.plusDays(14), null, 2, 20, new BigDecimal("300000"));
        VoucherUpdateRequest request = new VoucherUpdateRequest(1, write);
        stubActiveOwnerLocation(ownerUser, location);
        when(vouchers.lockById(5L)).thenReturn(Optional.of(existing));
        when(vouchers.saveAndFlush(existing)).thenReturn(existing);

        // Act
        VoucherResponse response = service.update(ownerUser, 5L, request);

        // Assert
        assertThat(response.status()).isEqualTo(VoucherStatus.PUBLISHED);
        assertThat(response.code()).isEqualTo("RENEW10");
        assertThat(response.discountValue()).isEqualByComparingTo("15000");
        assertThat(response.validTo()).isEqualTo(today.plusDays(14));
    }

    // Kiểm tra chặn cập nhật đồng thời (optimistic lock) trả về 409 CONFLICT khi version gửi lên cũ hơn DB.
    @Test
    void update_staleVersion_throwsConflict() {
        // Arrange
        UserPrincipal ownerUser = owner();
        Location location = activeLocation();
        LocalDate today = LocalDate.now();
        Voucher existing = Voucher.builder()
                .id(5L)
                .locationId(LOCATION_ID)
                .source(VoucherSource.CAMPAIGN)
                .status(VoucherStatus.DRAFT)
                .version(2)
                .build();
        VoucherWriteRequest write = new VoucherWriteRequest(
                "CODE1", "Tên", VoucherTargetGroup.ALL_PLAYERS,
                DiscountType.AMOUNT, new BigDecimal("10000"), BigDecimal.ZERO,
                today, today.plusDays(5), null, 1, 10, new BigDecimal("100000"));
        VoucherUpdateRequest request = new VoucherUpdateRequest(1, write);
        stubActiveOwnerLocation(ownerUser, location);
        when(vouchers.lockById(5L)).thenReturn(Optional.of(existing));

        // Act & Assert
        assertThatThrownBy(() -> service.update(ownerUser, 5L, request))
                .isInstanceOfSatisfying(AppException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(ex.getMessage()).isEqualTo("Voucher đã thay đổi; tải lại dữ liệu");
                });
        verify(vouchers, never()).saveAndFlush(any());
    }

    // Kiểm tra cấp voucher SPECIFIED tự khử trùng lặp playerId và chọn hạn dùng sớm hơn giữa validTo và grantValidDays.
    @Test
    void grant_duplicatePlayerIds_deduplicatesAndTakesEarlierRelativeExpiry() {
        // Arrange
        UserPrincipal ownerUser = owner();
        Location location = activeLocation();
        LocalDate today = LocalDate.now();
        Voucher voucher = Voucher.builder()
                .id(8L)
                .locationId(LOCATION_ID)
                .name("VIP")
                .source(VoucherSource.CAMPAIGN)
                .targetGroup(VoucherTargetGroup.SPECIFIED)
                .discountType(DiscountType.AMOUNT)
                .discountValue(new BigDecimal("30000"))
                .minOrderAmount(BigDecimal.ZERO)
                .validFrom(today)
                .validTo(today.plusDays(10))
                .grantValidDays(3)
                .status(VoucherStatus.PUBLISHED)
                .build();
        Account activePlayer = Account.builder().id(PLAYER_ID).role(Role.PLAYER).status(AccountStatus.ACTIVE).build();
        stubActiveOwnerLocation(ownerUser, location);
        when(vouchers.lockById(8L)).thenReturn(Optional.of(voucher));
        when(accounts.findById(PLAYER_ID)).thenReturn(Optional.of(activePlayer));
        when(grants.saveAndFlush(any(VoucherGrant.class))).thenAnswer(inv -> {
            VoucherGrant saved = inv.getArgument(0);
            saved.setId(55L);
            return saved;
        });

        // Act
        LocalDateTime before = LocalDateTime.now();
        List<PersonalVoucherResponse> result = service.grant(ownerUser, 8L,
                new VoucherGrantRequest(List.of(PLAYER_ID, PLAYER_ID)));
        LocalDateTime after = LocalDateTime.now();

        // Assert
        verify(grants, times(1)).saveAndFlush(any(VoucherGrant.class));
        assertThat(result).singleElement().satisfies(item -> {
            assertThat(item.grantId()).isEqualTo(55L);
            assertThat(item.grantStatus()).isEqualTo(VoucherGrantStatus.AVAILABLE);
            assertThat(item.expiresAt()).isBetween(before.plusDays(3), after.plusDays(3));
            assertThat(item.expiresAt()).isBefore(today.plusDays(11).atStartOfDay());
        });
    }

    // Kiểm tra tính giảm giá theo phần trăm làm tròn xuống đơn vị đồng và trả đúng số tiền còn lại.
    @Test
    void check_percentVoucher_roundsDiscountDownToWholeDong() {
        // Arrange
        LocalDate today = LocalDate.now();
        Voucher voucher = Voucher.builder()
                .id(12L)
                .locationId(LOCATION_ID)
                .code("SALE33")
                .source(VoucherSource.CAMPAIGN)
                .targetGroup(VoucherTargetGroup.ALL_PLAYERS)
                .discountType(DiscountType.PERCENT)
                .discountValue(new BigDecimal("33"))
                .minOrderAmount(new BigDecimal("500"))
                .validFrom(today.minusDays(1))
                .validTo(today.plusDays(5))
                .maxUsesPerPlayer(1)
                .maxTotalUses(5)
                .usedCount(0)
                .budget(new BigDecimal("1000"))
                .budgetUsed(BigDecimal.ZERO)
                .status(VoucherStatus.PUBLISHED)
                .build();
        when(vouchers.findIdByLocationAndCode(LOCATION_ID, "SALE33")).thenReturn(Optional.of(12L));
        when(vouchers.findById(12L)).thenReturn(Optional.of(voucher));
        when(locations.findById(LOCATION_ID)).thenReturn(Optional.of(activeLocation()));
        when(usages.countByVoucherIdAndPlayerIdAndStatus(12L, PLAYER_ID, VoucherUsageStatus.USED)).thenReturn(0L);

        // Act
        VoucherCheckResponse response = service.check(player(),
                new VoucherCheckRequest(LOCATION_ID, new BigDecimal("1001"), new VoucherSelection("sale33", null)));

        // Assert
        assertThat(response.voucherId()).isEqualTo(12L);
        assertThat(response.discountAmount()).isEqualByComparingTo("330");
        assertThat(response.amountAfterVoucher()).isEqualByComparingTo("671");
    }

    // Kiểm tra biên: voucher SPECIFIED đã STOPPED vẫn dùng được qua grantId (D166) tại đúng ngưỡng minOrderAmount và trần budget.
    @Test
    void check_stoppedSpecifiedGrantAtExactMinOrderAndBudgetCap_remainsValid() {
        // Arrange
        LocalDate today = LocalDate.now();
        Voucher voucher = Voucher.builder()
                .id(15L)
                .locationId(LOCATION_ID)
                .source(VoucherSource.CAMPAIGN)
                .targetGroup(VoucherTargetGroup.SPECIFIED)
                .discountType(DiscountType.AMOUNT)
                .discountValue(new BigDecimal("100"))
                .minOrderAmount(new BigDecimal("500"))
                .validFrom(today.minusDays(2))
                .validTo(today)
                .maxUsesPerPlayer(1)
                .maxTotalUses(5)
                .usedCount(4)
                .budget(new BigDecimal("500"))
                .budgetUsed(new BigDecimal("400"))
                .status(VoucherStatus.STOPPED)
                .build();
        VoucherGrant grant = VoucherGrant.builder()
                .id(44L)
                .voucherId(15L)
                .playerId(PLAYER_ID)
                .status(VoucherGrantStatus.AVAILABLE)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .build();
        when(grants.findById(44L)).thenReturn(Optional.of(grant));
        when(vouchers.findById(15L)).thenReturn(Optional.of(voucher));
        when(locations.findById(LOCATION_ID)).thenReturn(Optional.of(activeLocation()));
        when(usages.countByVoucherIdAndPlayerIdAndStatus(15L, PLAYER_ID, VoucherUsageStatus.USED)).thenReturn(0L);

        // Act
        VoucherCheckResponse response = service.check(player(),
                new VoucherCheckRequest(LOCATION_ID, new BigDecimal("500"), new VoucherSelection(null, 44L)));

        // Assert
        assertThat(response.voucherId()).isEqualTo(15L);
        assertThat(response.grantId()).isEqualTo(44L);
        assertThat(response.discountAmount()).isEqualByComparingTo("100");
        assertThat(response.amountAfterVoucher()).isEqualByComparingTo("400");
    }

    // Kiểm tra chặn trường hợp voucher làm tổng tiền phải trả về 0 đồng theo FR78/BR15 (D143).
    @Test
    void check_discountCoversFullOrderAmount_rejectsZeroPayableAmount() {
        // Arrange
        LocalDate today = LocalDate.now();
        Voucher voucher = Voucher.builder()
                .id(18L)
                .locationId(LOCATION_ID)
                .code("FULL100K")
                .source(VoucherSource.CAMPAIGN)
                .targetGroup(VoucherTargetGroup.ALL_PLAYERS)
                .discountType(DiscountType.AMOUNT)
                .discountValue(new BigDecimal("100000"))
                .minOrderAmount(BigDecimal.ZERO)
                .validFrom(today.minusDays(1))
                .validTo(today.plusDays(1))
                .maxUsesPerPlayer(1)
                .maxTotalUses(10)
                .usedCount(0)
                .budget(new BigDecimal("500000"))
                .budgetUsed(BigDecimal.ZERO)
                .status(VoucherStatus.PUBLISHED)
                .build();
        when(vouchers.findIdByLocationAndCode(LOCATION_ID, "FULL100K")).thenReturn(Optional.of(18L));
        when(vouchers.findById(18L)).thenReturn(Optional.of(voucher));
        when(locations.findById(LOCATION_ID)).thenReturn(Optional.of(activeLocation()));
        when(usages.countByVoucherIdAndPlayerIdAndStatus(18L, PLAYER_ID, VoucherUsageStatus.USED)).thenReturn(0L);

        // Act & Assert
        assertThatThrownBy(() -> service.check(player(),
                new VoucherCheckRequest(LOCATION_ID, new BigDecimal("100000"), new VoucherSelection("FULL100K", null))))
                .isInstanceOfSatisfying(AppException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(ex.getMessage()).isEqualTo("Voucher không thể làm số tiền phải trả bằng 0 (FR78, BR15)");
                });
    }
}
