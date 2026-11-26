package com.sep490.bms.controller.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.multipart.MultipartFile;

import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.payment.ConfirmPaymentRequest;
import com.sep490.bms.dto.payment.PaymentDetailResponse;
import com.sep490.bms.dto.payment.PaymentInstructionResponse;
import com.sep490.bms.dto.payment.PaymentResponse;
import com.sep490.bms.dto.payment.ResubmitRequest;
import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.enums.PackageType;
import com.sep490.bms.entity.enums.PaymentStatus;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.exception.GlobalExceptionHandler;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.payment.PaymentService;

/**
 * API thanh toán UC18 (Player xem hướng dẫn, QR, gửi chứng từ) và UC19 (Staff/Owner xác nhận, yêu cầu bổ sung,
 * từ chối): mã HTTP, câu báo theo kết quả, ảnh trả đúng kiểu, dữ liệu sai bị chặn trước service, quyền theo vai trò.
 */
class PaymentControllerTests {

    @Configuration(proxyBeanMethods = false)
    @EnableMethodSecurity
    static class Config {
        @Bean PaymentService paymentService() { return mock(PaymentService.class); }
        @Bean PaymentController paymentController(PaymentService service) { return new PaymentController(service); }
    }

    private static final String WAIT_MESSAGE = "Đã báo thanh toán. Vui lòng chờ nhân viên xác nhận.";

    private AnnotationConfigApplicationContext context;
    private PaymentService payments;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(Config.class);
        payments = context.getBean(PaymentService.class);
        mvc = MockMvcBuilders.standaloneSetup(context.getBean(PaymentController.class))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        context.close();
    }

    // ---- UC18: Player ----

    @Test
    void playerReadsInstructionsForBookingAndPackage() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(payments.getInstructions(player, 11L)).thenReturn(PaymentInstructionResponse.builder()
                .bookingId(11L).bookingCode("BK261130-7KQ2MX").build());
        when(payments.getPackageInstructions(player, 7L)).thenReturn(PaymentInstructionResponse.builder()
                .packageId(7L).build());

        mvc.perform(get("/api/bookings/11/payment-instructions")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingCode").value("BK261130-7KQ2MX"));
        mvc.perform(get("/api/booking-packages/7/payment-instructions")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.packageId").value(7));
    }

    @Test
    void qrImageIsServedWithItsOwnContentType() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(payments.loadQrImage(player, 11L)).thenReturn(image("location_1.png", new byte[] { 1, 2, 3 }));
        when(payments.loadPackageQrImage(player, 7L)).thenReturn(image("location_1.jpg", new byte[] { 4 }));

        mvc.perform(get("/api/bookings/11/payment-instructions/qr"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(new byte[] { 1, 2, 3 }));
        mvc.perform(get("/api/booking-packages/7/payment-instructions/qr"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG));
    }

    @Test
    void unknownImageTypeFallsBackToOctetStream() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(payments.loadQrImage(player, 11L)).thenReturn(image("qr", new byte[] { 1 }));

        mvc.perform(get("/api/bookings/11/payment-instructions/qr"))
                .andExpect(content().contentType(MediaType.APPLICATION_OCTET_STREAM));
    }

    @Test
    void playerSubmitsProofForBookingAndPackage() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(payments.submitProof(eq(player), eq(11L), any())).thenReturn(payment(PaymentStatus.AWAITING_CONFIRMATION));
        when(payments.submitPackageProof(eq(player), eq(7L), any())).thenReturn(payment(PaymentStatus.AWAITING_CONFIRMATION));
        MockMultipartFile proof = new MockMultipartFile("proof", "ck.png", "image/png", new byte[] { 9 });

        mvc.perform(multipart("/api/bookings/11/payments").file(proof))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value(WAIT_MESSAGE))
                .andExpect(jsonPath("$.data.status").value("AWAITING_CONFIRMATION"));
        mvc.perform(multipart("/api/booking-packages/7/payments").file(proof))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value(WAIT_MESSAGE));

        ArgumentCaptor<MultipartFile> sent = ArgumentCaptor.forClass(MultipartFile.class);
        verify(payments).submitProof(eq(player), eq(11L), sent.capture());
        assertThat(sent.getValue().getOriginalFilename()).isEqualTo("ck.png");
    }

    @Test
    void missingProofIsLeftToServiceWhichReportsMsg106() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(payments.submitProof(eq(player), eq(11L), isNull())).thenThrow(new AppException(
                "Vui lòng đính kèm ảnh chứng từ chuyển khoản. (MSG106)", HttpStatus.BAD_REQUEST));

        mvc.perform(multipart("/api/bookings/11/payments"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Vui lòng đính kèm ảnh chứng từ chuyển khoản. (MSG106)"));
    }

    @Test
    void playerReadsPaymentAndResubmits() throws Exception {
        UserPrincipal player = login(Role.PLAYER);
        when(payments.getPayment(player, 51L)).thenReturn(payment(PaymentStatus.RESUBMIT_REQUESTED));
        when(payments.resubmitProof(eq(player), eq(51L), any())).thenReturn(payment(PaymentStatus.AWAITING_CONFIRMATION));

        mvc.perform(get("/api/payments/51")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESUBMIT_REQUESTED"));
        mvc.perform(multipart("/api/payments/51/resubmit")
                        .file(new MockMultipartFile("proof", "lan2.png", "image/png", new byte[] { 1 })))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(WAIT_MESSAGE));
    }

    @Test
    void staffAndOwnerCannotUsePlayerPaymentApis() throws Exception {
        for (Role role : new Role[] { Role.STAFF, Role.OWNER, Role.ADMIN }) {
            login(role);
            mvc.perform(get("/api/bookings/11/payment-instructions")).andExpect(status().isForbidden());
            mvc.perform(multipart("/api/bookings/11/payments")).andExpect(status().isForbidden());
            mvc.perform(get("/api/payments/51")).andExpect(status().isForbidden());
        }
        verifyNoInteractions(payments);
    }

    @Test
    void proofImageIsOpenToPlayerStaffOwnerButNotAdmin() throws Exception {
        when(payments.loadProofImage(any(), eq(51L), eq(3L))).thenReturn(image("proof.png", new byte[] { 7 }));
        for (Role role : new Role[] { Role.PLAYER, Role.STAFF, Role.OWNER }) {
            login(role);
            mvc.perform(get("/api/payments/51/proofs/3/image"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.IMAGE_PNG));
        }
        login(Role.ADMIN);
        mvc.perform(get("/api/payments/51/proofs/3/image")).andExpect(status().isForbidden());
    }

    // ---- UC19: Staff, Owner ----

    @Test
    void staffAndOwnerListPendingWithDefaultPaging() throws Exception {
        UserPrincipal staff = login(Role.STAFF);
        PageResponse<PaymentResponse> page = PageResponse.<PaymentResponse>builder()
                .content(List.of(payment(PaymentStatus.AWAITING_CONFIRMATION))).totalPages(1).build();
        when(payments.listPending(any(), anyInt(), anyInt())).thenReturn(page);

        mvc.perform(get("/api/staff/payments")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(51));
        verify(payments).listPending(staff, 0, 20);

        UserPrincipal owner = login(Role.OWNER);
        mvc.perform(get("/api/staff/payments").param("page", "1").param("size", "5")).andExpect(status().isOk());
        verify(payments).listPending(owner, 1, 5);
    }

    @Test
    void staffReadsPendingDetail() throws Exception {
        UserPrincipal staff = login(Role.STAFF);
        when(payments.getPendingDetail(staff, 51L)).thenReturn(PaymentDetailResponse.builder()
                .payment(payment(PaymentStatus.AWAITING_CONFIRMATION)).courtName("Sân 1").build());

        mvc.perform(get("/api/staff/payments/51")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.courtName").value("Sân 1"));
    }

    @Test
    void playerCannotDecidePayments() throws Exception {
        login(Role.PLAYER);

        mvc.perform(get("/api/staff/payments")).andExpect(status().isForbidden());
        mvc.perform(post("/api/staff/payments/51/confirm")).andExpect(status().isForbidden());
        mvc.perform(json(post("/api/staff/payments/51/reject"), "{\"reason\":\"Sai tiền\"}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(payments);
    }

    @Test
    void confirmWithoutBodyMeansExactAmountAndNamesBookingCode() throws Exception {
        UserPrincipal staff = login(Role.STAFF);
        PaymentResponse confirmed = payment(PaymentStatus.CONFIRMED);
        confirmed.setBookingCode("BK261130-7KQ2MX");
        when(payments.confirm(eq(staff), eq(51L), isNull())).thenReturn(confirmed);

        mvc.perform(post("/api/staff/payments/51/confirm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã xác nhận thanh toán booking BK261130-7KQ2MX."));
    }

    @Test
    void confirmMessageForPackageAndDayOrderUsesPackageNumber() throws Exception {
        login(Role.OWNER);
        PaymentResponse pkg = payment(PaymentStatus.CONFIRMED);
        pkg.setPackageId(7L);
        pkg.setPackageType(PackageType.CUSTOM);
        PaymentResponse dayOrder = payment(PaymentStatus.CONFIRMED);
        dayOrder.setPackageId(8L);
        dayOrder.setPackageType(PackageType.DAY);
        when(payments.confirm(any(), eq(51L), any())).thenReturn(pkg);
        when(payments.confirm(any(), eq(52L), any())).thenReturn(dayOrder);

        mvc.perform(post("/api/staff/payments/51/confirm"))
                .andExpect(jsonPath("$.message").value("Đã xác nhận thanh toán gói PK7."));
        mvc.perform(post("/api/staff/payments/52/confirm"))
                .andExpect(jsonPath("$.message").value("Đã xác nhận thanh toán đơn đặt lẻ PK8."));
    }

    @Test
    void confirmPassesReceivedAmountAndRejectsInvalidAmount() throws Exception {
        UserPrincipal staff = login(Role.STAFF);
        when(payments.confirm(any(), any(), any())).thenReturn(payment(PaymentStatus.CONFIRMED));

        mvc.perform(json(post("/api/staff/payments/51/confirm"), "{\"receivedAmount\":250000}"))
                .andExpect(status().isOk());
        ArgumentCaptor<ConfirmPaymentRequest> request = ArgumentCaptor.forClass(ConfirmPaymentRequest.class);
        verify(payments).confirm(eq(staff), eq(51L), request.capture());
        assertThat(request.getValue().receivedAmount()).isEqualByComparingTo("250000");

        mvc.perform(json(post("/api/staff/payments/51/confirm"), "{\"receivedAmount\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.receivedAmount").value("Số tiền thực nhận phải lớn hơn 0"));
        mvc.perform(json(post("/api/staff/payments/51/confirm"), "{\"receivedAmount\":1000.5}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectNeedsReason() throws Exception {
        UserPrincipal staff = login(Role.STAFF);
        when(payments.reject(eq(staff), eq(51L), any())).thenReturn(payment(PaymentStatus.REJECTED));

        mvc.perform(json(post("/api/staff/payments/51/reject"), "{\"reason\":\" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.reason").value("Vui lòng nhập lý do từ chối"));
        mvc.perform(json(post("/api/staff/payments/51/reject"), "{\"reason\":\"Không thấy tiền về\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã từ chối giao dịch."));
    }

    @Test
    void resubmissionMessageDependsOnRemainingTurns() throws Exception {
        login(Role.STAFF);
        when(payments.requestResubmission(any(), eq(51L), any())).thenReturn(payment(PaymentStatus.RESUBMIT_REQUESTED));
        when(payments.requestResubmission(any(), eq(52L), any())).thenReturn(payment(PaymentStatus.REJECTED));
        String body = "{\"reason\":\"Ảnh mờ\",\"playerAtFault\":true}";

        mvc.perform(json(post("/api/staff/payments/51/request-resubmission"), body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã yêu cầu Player bổ sung."));
        mvc.perform(json(post("/api/staff/payments/52/request-resubmission"), body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Player đã hết lượt gửi lại chứng từ; giao dịch bị từ chối."));

        ArgumentCaptor<ResubmitRequest> request = ArgumentCaptor.forClass(ResubmitRequest.class);
        verify(payments).requestResubmission(any(), eq(51L), request.capture());
        assertThat(request.getValue().playerAtFault()).isTrue();
    }

    @Test
    void resubmissionMustSayWhetherPlayerIsAtFault() throws Exception {
        login(Role.STAFF);

        mvc.perform(json(post("/api/staff/payments/51/request-resubmission"), "{\"reason\":\"Ảnh mờ\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.playerAtFault").value("Vui lòng chọn lỗi có do Player hay không"));
        verifyNoInteractions(payments);
    }

    @Test
    void paymentTransferredToOwnerBlocksStaffWith409() throws Exception {
        login(Role.STAFF);
        when(payments.confirm(any(), eq(51L), any())).thenThrow(new AppException(
                com.sep490.bms.service.payment.PaymentTransferPolicy.TRANSFERRED_MESSAGE, HttpStatus.CONFLICT));

        mvc.perform(post("/api/staff/payments/51/confirm"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(com.sep490.bms.service.payment.PaymentTransferPolicy.TRANSFERRED_MESSAGE));
    }

    private UserPrincipal login(Role role) {
        UserPrincipal user = UserPrincipal.builder().id(7L).role(role).locationId(1L).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                user, null, AuthorityUtils.createAuthorityList("ROLE_" + role.name())));
        return user;
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder json(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private static PaymentResponse payment(PaymentStatus status) {
        return PaymentResponse.builder().id(51L).status(status).amountDue(new BigDecimal("180000")).build();
    }

    private static Resource image(String name, byte[] bytes) {
        return new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return name;
            }
        };
    }
}
