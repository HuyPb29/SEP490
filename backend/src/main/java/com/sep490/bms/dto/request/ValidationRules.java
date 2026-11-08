package com.sep490.bms.dto.request;

public final class ValidationRules {
    private ValidationRules() {}
    public static final String USERNAME = "^[a-z][a-z0-9._]{5,31}$";
    public static final String USERNAME_MESSAGE = "Tên đăng nhập phải gồm 6–32 ký tự và bắt đầu bằng chữ thường (DR22)";
    public static final String PASSWORD = "^(?=.*[A-Za-z])(?=.*[0-9])[^\\s]{8,32}$";
    public static final String PASSWORD_MESSAGE = "Mật khẩu phải có 8–32 ký tự, có chữ và số, không khoảng trắng (DR23)";
    public static final String NAME = "^[\\p{L}\\p{M}]+(?: [\\p{L}\\p{M}]+)*$";
}
