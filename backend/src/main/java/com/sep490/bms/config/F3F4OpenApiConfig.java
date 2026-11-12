package com.sep490.bms.config;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Nhóm Swagger cho F3 (Tìm và đặt sân), F4 (Thanh toán) và nhóm "all" (mọi API).
 * Khi đã có một GroupedOpenApi (F6OpenApiConfig) thì Swagger UI chỉ hiện các nhóm được khai báo,
 * nên API ngoài F6 phải có nhóm riêng mới thấy được.
 */
@Configuration
public class F3F4OpenApiConfig {

    /** Mọi API của hệ thống; tên "all" đứng đầu danh sách nên là nhóm mặc định khi mở Swagger UI. */
    @Bean
    public GroupedOpenApi allOpenApi(@Qualifier("locationHeader") OpenApiCustomizer locationHeader) {
        return GroupedOpenApi.builder().group("all")
                .pathsToMatch("/api/**")
                .addOpenApiCustomizer(locationHeader)
                .build();
    }

    /** UC11–UC20, kèm đăng nhập để lấy token ngay trong nhóm này. */
    @Bean
    public GroupedOpenApi f3F4OpenApi(@Qualifier("locationHeader") OpenApiCustomizer locationHeader) {
        return GroupedOpenApi.builder().group("f3-f4-booking-payment")
                .pathsToMatch(
                        "/api/auth/login",
                        "/api/locations", "/api/locations/*", "/api/locations/*/schedules",
                        "/api/locations/*/batch-offers",
                        "/api/bookings/**", "/api/booking-orders/**", "/api/booking-packages/**",
                        "/api/me/bookings", "/api/me/booking-packages",
                        "/api/staff/bookings/**",
                        "/api/payments/**", "/api/staff/payments/**",
                        "/api/staff/reconciliations/**", "/api/owner/reconciliations")
                .addOpenApiCustomizer(locationHeader)
                .build();
    }
}
