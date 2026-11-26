package com.sep490.bms.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import com.sep490.bms.service.notification.RealtimeUpdates;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Configuration
@RequiredArgsConstructor
public class RealtimeWebConfig implements WebMvcConfigurer {
    private final RealtimeUpdates updates;

    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                    Object handler, Exception error) {
                String path = request.getRequestURI();
                if (error == null && response.getStatus() >= 200 && response.getStatus() < 300
                        && java.util.Set.of("POST", "PUT", "PATCH", "DELETE").contains(request.getMethod())
                        && request.getUserPrincipal() != null
                        && !path.startsWith("/api/auth/") && !path.startsWith("/api/notifications/")
                        && !path.matches(".*/(preview|summary|check)$")) {
                    // Service transactions have committed before MVC completes the response.
                    updates.changed(null);
                }
            }
        }).addPathPatterns("/api/**");
    }
}
