package com.sep490.bms.config;

import org.springframework.context.annotation.*;

import io.swagger.v3.oas.models.*;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.*;

/**
 * Cấu hình thông tin OpenAPI, xác thực Bearer JWT và header chọn địa điểm.
 */
@Configuration
public class OpenApiConfig {
    @Bean public org.springdoc.core.customizers.OpenApiCustomizer locationHeader() {
        return api -> api.getPaths().forEach((path, item) -> {
            boolean scoped = (path.startsWith("/api/owner/") && !path.equals("/api/owner/locations")
                    && !path.startsWith("/api/owner/locations/")) || path.startsWith("/api/staff/");
            if (scoped) item.readOperations().forEach(operation -> operation.addParametersItem(
                new io.swagger.v3.oas.models.parameters.Parameter().name("X-Location-Id").in("header")
                    .description("Owner: bắt buộc, địa điểm phải thuộc Owner. Staff: có thể bỏ qua, dùng địa điểm của tài khoản.")
                    .required(path.startsWith("/api/owner/"))
                    .schema(new io.swagger.v3.oas.models.media.IntegerSchema().format("int64"))));
        });
    }

    @Bean public OpenAPI bmsOpenAPI() {
        return new OpenAPI().info(new Info().title("BMS API").version("1.0")
            .description("BMS theo đặc tả v19. Owner gửi X-Location-Id cho thao tác theo địa điểm. Voucher, điểm và ghi nhận thanh toán thực hiện trong giao dịch nghiệp vụ."))
            .components(new Components().addSecuritySchemes("bearerAuth", new SecurityScheme()
                .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
            .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }
}
