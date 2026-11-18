package com.sep490.bms.common;

import java.util.List;

import com.sep490.bms.exception.AppException;

/**
 * DR33 (D165): trình độ chơi có 4 mức cố định, dùng cho hồ sơ Player và trình độ của đội.
 * Trình độ do người dùng tự khai; hệ thống chỉ kiểm tra giá trị nằm trong danh sách.
 */
public final class SkillLevels {

    public static final List<String> ALL = List.of("Mới chơi", "Trung bình", "Khá", "Nâng cao");

    private SkillLevels() {
    }

    public static boolean isValid(String value) {
        return value != null && ALL.contains(value.trim());
    }

    /** Trả giá trị đã bỏ khoảng trắng; ngoài danh sách thì báo lỗi với tên trường cho trước. */
    public static String require(String value, String field) {
        if (!isValid(value)) {
            throw new AppException(field + " phải là một trong các mức: " + String.join(", ", ALL));
        }
        return value.trim();
    }
}
