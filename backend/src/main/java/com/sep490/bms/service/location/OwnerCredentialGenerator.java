package com.sep490.bms.service.location;

import java.security.SecureRandom;

import org.springframework.stereotype.Component;

/**
 * Feature: F2 - Quản lý địa điểm
 * FR11, BR59: khi Admin duyệt đơn của Guest, hệ thống sinh tên đăng nhập và mật khẩu đầu tiên của Owner.
 *
 * Tên đăng nhập "owner" + 6 chữ số (11 ký tự): đúng DR22 (4–20 ký tự, chữ thường, bắt đầu bằng chữ)
 * và cũng lọt quy tắc 6–32 ký tự đang dùng ở ValidationRules.USERNAME. Trùng thì ServiceRegistrationService sinh lại.
 * Mật khẩu 10 ký tự chữ và số, luôn có ít nhất một chữ cái và một chữ số, không khoảng trắng (DR23).
 * Bỏ các ký tự dễ đọc nhầm (0/O, 1/l/I) vì chủ sân gõ lại mật khẩu từ email.
 */
@Component
public class OwnerCredentialGenerator {

    static final String USERNAME_PREFIX = "owner";
    static final int PASSWORD_LENGTH = 10;

    private static final String LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String DIGITS = "23456789";
    private static final String ALPHABET = LETTERS + DIGITS;

    private final SecureRandom random = new SecureRandom();

    public String username() {
        return USERNAME_PREFIX + String.format("%06d", random.nextInt(1_000_000));
    }

    public String password() {
        char[] chars = new char[PASSWORD_LENGTH];
        chars[0] = LETTERS.charAt(random.nextInt(LETTERS.length()));
        chars[1] = DIGITS.charAt(random.nextInt(DIGITS.length()));
        for (int i = 2; i < chars.length; i++) {
            chars[i] = ALPHABET.charAt(random.nextInt(ALPHABET.length()));
        }
        // Trộn để chữ cái và chữ số bắt buộc không luôn nằm ở hai vị trí đầu.
        for (int i = chars.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            char tmp = chars[i];
            chars[i] = chars[j];
            chars[j] = tmp;
        }
        return new String(chars);
    }
}
