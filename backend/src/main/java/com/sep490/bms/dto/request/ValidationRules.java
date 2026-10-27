package com.sep490.bms.dto.request;

public final class ValidationRules {
    private ValidationRules() {}
    public static final String PASSWORD = "^(?=.*[A-Za-z])(?=.*[0-9])[^\\s]{8,32}$";
    public static final String PASSWORD_MESSAGE = "Mật khẩu phải có 8–32 ký tự, có chữ và số, không khoảng trắng (DR23)";
    public static final String NAME = "^[\\p{L}\\p{M}]+(?: [\\p{L}\\p{M}]+)*$";
}
