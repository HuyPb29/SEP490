package com.sep490.bms.config;

import java.util.List;
import java.util.Map;

import io.swagger.v3.oas.models.media.BooleanSchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Khai báo nhóm OpenAPI cho tài khoản và thay đổi booking, kèm yêu cầu xác thực và định dạng lỗi.
 */
@Configuration
public class AccountAndBookingChangeOpenApiConfig {
    private static final Map<String, String> ERRORS = Map.of(
            "400", "Dữ liệu hoặc điều kiện nghiệp vụ không hợp lệ",
            "401", "Thiếu, sai hoặc hết hạn Bearer token",
            "403", "Sai vai trò hoặc ngoài phạm vi tài khoản/địa điểm",
            "404", "Không tìm thấy dữ liệu",
            "409", "Trùng dữ liệu hoặc xung đột trạng thái");

    @Bean
    public GroupedOpenApi accountOpenApi(@Qualifier("locationHeader") OpenApiCustomizer locationHeader) {
        return GroupedOpenApi.builder().group("f1-accounts")
                .pathsToMatch("/api/auth/**", "/api/users/me", "/api/users/me/password", "/api/owner/staff-members/**",
                        "/api/admin/accounts/**", "/api/admin/account-audits")
                .addOpenApiCustomizer(locationHeader)
                .addOpenApiCustomizer(api -> api.getPaths().forEach((path, item) -> item.readOperations().forEach(operation -> {
                    boolean publicAuth = path.startsWith("/api/auth/") && !path.endsWith("/logout");
                    if (publicAuth) operation.setSecurity(List.of());
                    ERRORS.forEach((status, description) -> {
                        if (!publicAuth || !status.equals("403")) {
                            operation.getResponses().putIfAbsent(status, error(description));
                        }
                    });
                    if (path.endsWith("/register") || path.endsWith("/resend-otp") || path.endsWith("/forgot-password")) {
                        operation.getResponses().putIfAbsent("429", error("Chưa qua thời gian chờ hoặc đã vượt giới hạn gửi OTP"));
                        operation.getResponses().putIfAbsent("503", error("Dịch vụ email tạm thời không gửi được OTP"));
                    }
                }))).build();
    }

    @Bean
    public GroupedOpenApi bookingChangeOpenApi(@Qualifier("locationHeader") OpenApiCustomizer locationHeader) {
        return GroupedOpenApi.builder().group("f5-booking-changes")
                .pathsToMatch("/api/bookings/*/reschedule-deadline", "/api/bookings/*/reschedule-requests/**",
                        "/api/reschedule-requests/**",
                        "/api/reschedule-payments/**", "/api/staff/reschedule-payments/**", "/api/bookings/*/cancel",
                        "/api/owner/bookings/cancellable", "/api/owner/bookings/*/cancel", "/api/staff/bookings/*/cancel", "/api/me/affected-bookings",
                        "/api/affected-bookings/**", "/api/owner/refunds/**", "/api/matches/*/keep-after-reschedule",
                        "/api/matches/*/cancel")
                .addOpenApiCustomizer(locationHeader)
                .addOpenApiCustomizer(api -> api.getPaths().values().forEach(item -> item.readOperations().forEach(operation ->
                        ERRORS.forEach((status, description) -> operation.getResponses().putIfAbsent(status, error(description))))))
                .build();
    }

    private static ApiResponse error(String description) {
        var body = new ObjectSchema()
                .addProperty("success", new BooleanSchema().example(false))
                .addProperty("message", new StringSchema())
                .addProperty("errors", new ObjectSchema().additionalProperties(true))
                .addProperty("timestamp", new StringSchema().format("date-time"));
        return new ApiResponse().description(description).content(new Content().addMediaType("application/json",
                new MediaType().schema(body)));
    }
}
