package com.sep490.bms.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Feature: UC37 - Automated tasks and notifications
 * Bật hạ tầng @Scheduled. Không sửa SecurityConfig hay application.properties:
 * mọi job đọc tham số qua {@code @Scheduled} với giá trị mặc định trong code.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
