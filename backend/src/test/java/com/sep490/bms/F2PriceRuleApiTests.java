package com.sep490.bms;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import com.sep490.bms.entity.Account;
import com.sep490.bms.entity.AccountStatus;
import com.sep490.bms.entity.Location;
import com.sep490.bms.entity.Role;
import com.sep490.bms.entity.enums.DiscountType;
import com.sep490.bms.entity.enums.VoucherSource;
import com.sep490.bms.entity.enums.VoucherStatus;
import com.sep490.bms.entity.enums.VoucherTargetGroup;
import com.sep490.bms.entity.location.BatchOffer;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.PriceRule;
import com.sep490.bms.entity.promotion.Voucher;
import com.sep490.bms.repository.AccountRepository;
import com.sep490.bms.repository.LocationRepository;
import com.sep490.bms.repository.location.BatchOfferRepository;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.PriceRuleRepository;
import com.sep490.bms.repository.promotion.VoucherRepository;
import com.sep490.bms.security.JwtTokenProvider;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh
 *
 * Test tích hợp cho UC09 (bảng giá theo sân và ưu đãi đặt theo lô).
 * Mỗi test tự tạo dữ liệu riêng và rollback sau khi xong, không phụ thuộc seed.
 */
@SpringBootTest
@Transactional
class F2PriceRuleApiTests {

    private static final String PRICE_RULES = "/api/owner/courts/{id}/price-rules";
    private static final String PRICE_RULE_BY_ID = "/api/owner/price-rules/{id}";
    private static final String BATCH_OFFERS = "/api/owner/batch-offers";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private LocationRepository locationRepository;

    @Autowired
    private CourtRepository courtRepository;

    @Autowired
    private PriceRuleRepository priceRuleRepository;

    @Autowired
    private BatchOfferRepository batchOfferRepository;

    @Autowired
    private VoucherRepository voucherRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private MockMvc mockMvc;

    private Account owner;
    private Account otherOwner;
    private Location location;
    private Location otherLocation;
    private Court court;
    private Voucher voucher;
    private Voucher foreignVoucher;
    private String ownerToken;
    private String otherOwnerToken;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        owner = createAccount(Role.OWNER, "OWNER");
        otherOwner = createAccount(Role.OWNER, "OWNER2");

        location = createLocation(owner.getId(), "UC09 Test Location A");
        otherLocation = createLocation(otherOwner.getId(), "UC09 Test Location B");
        court = createCourt(location.getId(), "UC09 Court A1");

        voucher = createVoucher(location.getId(), "UC09V10");
        foreignVoucher = createVoucher(otherLocation.getId(), "UC09V20");

        ownerToken = jwtTokenProvider.generateToken(owner);
        otherOwnerToken = jwtTokenProvider.generateToken(otherOwner);
    }

    // ------------------------------------------------------- bảng giá

    @Test
    void ownerSeesPriceRulesOfOwnedCourt() throws Exception {
        createRule(court.getId(), "1111100", 360, 1020, 60000);

        mockMvc.perform(get(PRICE_RULES, court.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].courtName").value("UC09 Court A1"))
                .andExpect(jsonPath("$.data[0].applyDays").value("1111100"))
                .andExpect(jsonPath("$.data[0].dayLabels[0]").value("Thứ 2"))
                .andExpect(jsonPath("$.data[0].startTime").value("06:00"))
                .andExpect(jsonPath("$.data[0].endTime").value("17:00"))
                .andExpect(jsonPath("$.data[0].pricePerSlot").value(60000));
    }

    @Test
    void ownerCannotReadAnotherOwnersPriceRules() throws Exception {
        mockMvc.perform(get(PRICE_RULES, court.getId())
                        .header("Authorization", bearer(otherOwnerToken))
                        .header("X-Location-Id", String.valueOf(otherLocation.getId())))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void createPriceRuleMapsDaysToMask() throws Exception {
        mockMvc.perform(post(PRICE_RULES, court.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ruleJson("[6,7]", "06:00", "12:00", 120000, "2026-11-01", null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.applyDays").value("0000011"))
                .andExpect(jsonPath("$.data.days[0]").value(6))
                .andExpect(jsonPath("$.data.startMinute").value(360))
                .andExpect(jsonPath("$.data.endMinute").value(720))
                .andExpect(jsonPath("$.data.active").value(true));
    }

    @Test
    void createPriceRuleRejectsOverlappingWindow() throws Exception {
        createRule(court.getId(), "1111100", 1020, 1320, 90000);

        mockMvc.perform(post(PRICE_RULES, court.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ruleJson("[3]", "18:00", "20:00", 100000, "2026-11-15", null)))
                .andExpect(status().isConflict());
    }

    @Test
    void createPriceRuleAllowsSameWindowOnDifferentDays() throws Exception {
        createRule(court.getId(), "1111100", 1020, 1320, 90000);

        mockMvc.perform(post(PRICE_RULES, court.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ruleJson("[6,7]", "17:00", "22:00", 110000, "2026-11-01", null)))
                .andExpect(status().isCreated());
    }

    @Test
    void createPriceRuleRejectsTimeNotMultipleOfThirtyMinutes() throws Exception {
        mockMvc.perform(post(PRICE_RULES, court.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ruleJson("[2]", "17:15", "18:00", 80000, "2026-11-01", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void createPriceRuleRejectsEmptyDays() throws Exception {
        mockMvc.perform(post(PRICE_RULES, court.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ruleJson("[]", "17:00", "18:00", 80000, "2026-11-01", null)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updatePriceRuleKeepsUnsentFields() throws Exception {
        PriceRule rule = createRule(court.getId(), "1111100", 360, 1020, 60000);

        mockMvc.perform(patch(PRICE_RULE_BY_ID, rule.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pricePerSlot\":65000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pricePerSlot").value(65000))
                .andExpect(jsonPath("$.data.applyDays").value("1111100"))
                .andExpect(jsonPath("$.data.startMinute").value(360));
    }

    @Test
    void updatePriceRuleRejectsOverlapWithOtherRule() throws Exception {
        createRule(court.getId(), "1000000", 480, 600, 70000);
        PriceRule second = createRule(court.getId(), "0100000", 540, 660, 70000);

        mockMvc.perform(patch(PRICE_RULE_BY_ID, second.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"days\":[1,2]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void deletePriceRuleThenNotFound() throws Exception {
        PriceRule rule = createRule(court.getId(), "1111100", 360, 1020, 60000);

        mockMvc.perform(delete(PRICE_RULE_BY_ID, rule.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId())))
                .andExpect(status().isOk());

        mockMvc.perform(delete(PRICE_RULE_BY_ID, rule.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId())))
                .andExpect(status().isNotFound());
    }

    @Test
    void ownerCannotTouchAnotherOwnersPriceRule() throws Exception {
        PriceRule rule = createRule(court.getId(), "1111100", 360, 1020, 60000);

        mockMvc.perform(delete(PRICE_RULE_BY_ID, rule.getId())
                        .header("Authorization", bearer(otherOwnerToken))
                        .header("X-Location-Id", String.valueOf(otherLocation.getId())))
                .andExpect(status().is4xxClientError());
    }

    // -------------------------------------------------- ưu đãi theo lô

    @Test
    void ownerListsBatchOffersOfSelectedLocation() throws Exception {
        createBatchOffer(location.getId(), "Ưu đãi tháng 11", voucher.getId());

        mockMvc.perform(get(BATCH_OFFERS)
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].voucherCode").value("UC09V10"))
                .andExpect(jsonPath("$.data[0].discountType").value("PERCENT"))
                .andExpect(jsonPath("$.data[0].voucherStatus").value("PUBLISHED"));
    }

    @Test
    void batchOfferRequiresSelectedLocationHeader() throws Exception {
        mockMvc.perform(get(BATCH_OFFERS).header("Authorization", bearer(ownerToken)))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void createBatchOfferWithPublishedVoucher() throws Exception {
        mockMvc.perform(post(BATCH_OFFERS)
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offerJson("Ưu đãi đặt lô", "2026-11-01", "2026-11-30", 500000,
                                voucher.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.locationId").value(location.getId()))
                .andExpect(jsonPath("$.data.voucherId").value(voucher.getId()))
                .andExpect(jsonPath("$.data.minPackageAmount").value(500000));
    }

    @Test
    void createBatchOfferRejectsVoucherOfAnotherLocation() throws Exception {
        mockMvc.perform(post(BATCH_OFFERS)
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offerJson("Sai voucher", "2026-11-01", "2026-11-30", 500000,
                                foreignVoucher.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void createBatchOfferRejectsEndDateBeforeStartDate() throws Exception {
        mockMvc.perform(post(BATCH_OFFERS)
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offerJson("Sai ngày", "2026-11-30", "2026-11-01", 500000,
                                voucher.getId())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateBatchOfferChangesAmount() throws Exception {
        BatchOffer offer = createBatchOffer(location.getId(), "Ưu đãi cũ", voucher.getId());

        mockMvc.perform(patch(BATCH_OFFERS + "/" + offer.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"minPackageAmount\":800000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.minPackageAmount").value(800000))
                .andExpect(jsonPath("$.data.name").value("Ưu đãi cũ"));
    }

    @Test
    void deleteBatchOfferThenNotFound() throws Exception {
        BatchOffer offer = createBatchOffer(location.getId(), "Ưu đãi xoá", voucher.getId());

        mockMvc.perform(delete(BATCH_OFFERS + "/" + offer.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId())))
                .andExpect(status().isOk());

        mockMvc.perform(delete(BATCH_OFFERS + "/" + offer.getId())
                        .header("Authorization", bearer(ownerToken))
                        .header("X-Location-Id", String.valueOf(location.getId())))
                .andExpect(status().isNotFound());
    }

    @Test
    void ownerCannotTouchAnotherOwnersBatchOffer() throws Exception {
        BatchOffer offer = createBatchOffer(location.getId(), "Ưu đãi của owner khác", voucher.getId());

        mockMvc.perform(patch(BATCH_OFFERS + "/" + offer.getId())
                        .header("Authorization", bearer(otherOwnerToken))
                        .header("X-Location-Id", String.valueOf(otherLocation.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"hack\"}"))
                .andExpect(status().is4xxClientError());
    }

    // ------------------------------------------------------------- helpers

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String ruleJson(String days, String start, String end, long price,
            String validFrom, String validTo) {
        return "{\"days\":" + days + ",\"startTime\":\"" + start + "\",\"endTime\":\"" + end
                + "\",\"pricePerSlot\":" + price + ",\"validFrom\":\"" + validFrom + "\""
                + (validTo == null ? "" : ",\"validTo\":\"" + validTo + "\"") + "}";
    }

    private String offerJson(String name, String start, String end, long minAmount, Long voucherId) {
        return "{\"name\":\"" + name + "\",\"startDate\":\"" + start + "\",\"endDate\":\"" + end
                + "\",\"minPackageAmount\":" + minAmount + ",\"voucherId\":" + voucherId + "}";
    }

    private PriceRule createRule(Long courtId, String mask, int start, int end, long price) {
        return priceRuleRepository.save(PriceRule.builder()
                .courtId(courtId)
                .applyDays(mask)
                .startMinute(start)
                .endMinute(end)
                .pricePerSlot(BigDecimal.valueOf(price))
                .validFrom(LocalDate.of(2026, 1, 1))
                .build());
    }

    private BatchOffer createBatchOffer(Long locationId, String name, Long voucherId) {
        return batchOfferRepository.save(BatchOffer.builder()
                .locationId(locationId)
                .name(name)
                .startDate(LocalDate.of(2026, 11, 1))
                .endDate(LocalDate.of(2026, 11, 30))
                .minPackageAmount(BigDecimal.valueOf(500_000))
                .voucherId(voucherId)
                .build());
    }

    private Voucher createVoucher(Long locationId, String code) {
        return voucherRepository.save(Voucher.builder()
                .locationId(locationId)
                .code(code)
                .name("Voucher " + code)
                .source(VoucherSource.BATCH_OFFER)
                .targetGroup(VoucherTargetGroup.ALL_PLAYERS)
                .discountType(DiscountType.PERCENT)
                .discountValue(BigDecimal.TEN)
                .minOrderAmount(BigDecimal.ZERO)
                .usedCount(0)
                .budgetUsed(BigDecimal.ZERO)
                .status(VoucherStatus.PUBLISHED)
                .createdAt(LocalDateTime.now())
                .build());
    }

    /**
     * Tạo tài khoản test. Phải tuân ràng buộc của bảng account:
     * username bắt đầu bằng chữ thường, chỉ [a-z0-9._]; PLAYER/OWNER bắt buộc có email + phone 10 số.
     */
    private Account createAccount(Role role, String prefix) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = prefix.toLowerCase() + suffix;
        String phone = "09" + String.format("%08d", ThreadLocalRandom.current().nextInt(100_000_000));
        return accountRepository.save(Account.builder()
                .username(username)
                .email(username + "@uc09test.local")
                .phone(phone)
                .passwordHash("$2a$10$Ed6H/sJiKXsXTc.gjREbiO/l9iIoiShEmDjdEOI0zx5mrszl0FoGK")
                .fullName("UC09 Test " + prefix)
                .role(role)
                .status(AccountStatus.ACTIVE)
                .createdAt(LocalDateTime.now())
                .build());
    }

    private Location createLocation(Long ownerId, String name) {
        return locationRepository.save(Location.builder()
                .ownerId(ownerId)
                .name(name)
                .address("1 UC09 Street")
                .latitude(new BigDecimal("10.850000"))
                .longitude(new BigDecimal("106.750000"))
                .contactPhone("0900000009")
                .createdAt(LocalDateTime.now())
                .build());
    }

    private Court createCourt(Long locationId, String name) {
        return courtRepository.save(Court.builder()
                .locationId(locationId)
                .name(name)
                .active(true)
                .createdAt(LocalDateTime.now())
                .build());
    }
}
