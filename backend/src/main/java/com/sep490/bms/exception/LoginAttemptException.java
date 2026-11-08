package com.sep490.bms.exception;

import org.springframework.http.HttpStatus;

/** A failed login commits its counter and temporary lock, without committing unrelated failures. */
public class LoginAttemptException extends AppException {
    public LoginAttemptException() { super("Tài khoản hoặc mật khẩu không chính xác (MSG10)",HttpStatus.UNAUTHORIZED); }
}
