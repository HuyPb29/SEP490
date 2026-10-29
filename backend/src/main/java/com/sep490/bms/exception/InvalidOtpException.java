package com.sep490.bms.exception;

/** A rejected code must still commit the failed-attempt counter. */
public class InvalidOtpException extends AppException {
    public InvalidOtpException() {
        super("Mã xác thực không chính xác");
    }
}
