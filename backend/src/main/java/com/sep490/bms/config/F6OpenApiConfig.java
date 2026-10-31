package com.sep490.bms.config;
import org.springframework.context.annotation.*;
import org.springdoc.core.models.GroupedOpenApi;
import io.swagger.v3.oas.models.responses.ApiResponse;
@Configuration
public class F6OpenApiConfig {
    @Bean
    public GroupedOpenApi f6LoyaltyOpenApi(@org.springframework.beans.factory.annotation.Qualifier("locationHeader")
            org.springdoc.core.customizers.OpenApiCustomizer locationHeader) {
        return GroupedOpenApi.builder().group("f6-loyalty")
                .pathsToMatch("/api/me/loyalty-*","/api/owner/loyalty-*","/api/owner/loyalty-milestones/**")
                .addOpenApiCustomizer(locationHeader)
                .addOpenApiCustomizer(api -> api.getPaths().forEach((path,item) -> item.readOperationsMap().forEach((method,op) -> {
                    for(String code:java.util.List.of("400","401","403","404","409"))
                        op.getResponses().addApiResponse(code,new ApiResponse().description("ApiResponse: validation/auth/scope/resource/conflict"));
                    if(method==io.swagger.v3.oas.models.PathItem.HttpMethod.POST) {
                        var response=op.getResponses().remove("200");
                        op.getResponses().addApiResponse("201",response==null ? new ApiResponse().description("Created"):response);
                    }
                }))).build();
    }
    @Bean
    public GroupedOpenApi f6OpenApi(@org.springframework.beans.factory.annotation.Qualifier("locationHeader")
            org.springdoc.core.customizers.OpenApiCustomizer locationHeader) {
        return GroupedOpenApi.builder().group("f6-vouchers")
                .pathsToMatch("/api/locations/*/vouchers","/api/me/vouchers","/api/owner/vouchers","/api/owner/vouchers/**",
                        "/api/admin/vouchers","/api/admin/vouchers/**","/api/vouchers/check")
                .addOpenApiCustomizer(locationHeader)
                .addOpenApiCustomizer(api -> api.getPaths().forEach((path,item) -> item.readOperationsMap().forEach((method,op) -> {
                    op.getResponses().addApiResponse("400",new ApiResponse().description("Dữ liệu/điều kiện voucher không hợp lệ (ApiResponse envelope)"));
                    op.getResponses().addApiResponse("404",new ApiResponse().description("Không tìm thấy hoặc facility không hoạt động"));
                    if(!path.startsWith("/api/locations/")) {
                        op.getResponses().addApiResponse("401",new ApiResponse().description("Thiếu/sai Bearer token"));
                        op.getResponses().addApiResponse("403",new ApiResponse().description("Sai role hoặc ngoài facility scope"));
                    } else op.setSecurity(java.util.List.of());
                    op.getResponses().addApiResponse("409",new ApiResponse().description("Sai trạng thái/version hoặc xung đột dữ liệu"));
                    if(method==io.swagger.v3.oas.models.PathItem.HttpMethod.POST &&
                            (path.equals("/api/owner/vouchers") || path.endsWith("/grants"))) {
                        var response=op.getResponses().remove("200");
                        op.getResponses().addApiResponse("201",response==null ? new ApiResponse().description("Đã tạo"):response);
                    }
                }))).build();
    }
}
