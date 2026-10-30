package com.sep490.bms.service.booking;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.booking.BookingRepository;

import lombok.RequiredArgsConstructor;

/**
 * Sinh mã booking để Player, Staff đọc cho nhau (ví dụ BK261028-7KQ2MX, 15 ký tự; cột booking_code tối đa 20).
 * Phần ngẫu nhiên bỏ các ký tự dễ nhầm (0/O, 1/I/L) vì Staff có thể phải đọc mã qua điện thoại.
 * Không lấy theo id vì booking phải có mã ngay lúc lưu. Unique uq_booking_booking_code là chốt chặn cuối.
 */
@Service
@RequiredArgsConstructor
public class BookingCodeGenerator {

    private static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    private static final int RANDOM_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyMMdd");

    private final SecureRandom random = new SecureRandom();
    private final BookingRepository bookingRepository;

    public String next() {
        String prefix = "BK" + LocalDate.now().format(DATE) + "-";
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String code = prefix + randomPart();
            if (!bookingRepository.existsByBookingCode(code)) {
                return code;
            }
        }
        // 31^6 ≈ 887 triệu mã mỗi ngày nên gần như không xảy ra.
        throw new AppException("Không sinh được mã booking, vui lòng thử lại", HttpStatus.SERVICE_UNAVAILABLE);
    }

    private String randomPart() {
        StringBuilder sb = new StringBuilder(RANDOM_LENGTH);
        for (int i = 0; i < RANDOM_LENGTH; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
