package com.sep490.bms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Khởi động ứng dụng Spring Boot và nạp các thành phần backend của BMS.
 */
@SpringBootApplication
public class BmsApplication {

	public static void main(String[] args) {
		SpringApplication.run(BmsApplication.class, args);
	}

}
