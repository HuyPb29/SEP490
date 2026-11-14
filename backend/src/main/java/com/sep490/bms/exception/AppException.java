package com.sep490.bms.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * Biểu diễn lỗi nghiệp vụ cùng mã trạng thái HTTP để trả về qua API.
 */
@Getter
public class AppException extends RuntimeException {

    private final HttpStatus status;
    private final java.util.Map<String, String> fieldErrors;

    public AppException(String message) {
        this(message, HttpStatus.BAD_REQUEST);
    }

    public AppException(String message, HttpStatus status) {
        this(message, status, java.util.Map.of());
    }

    public AppException(String message, HttpStatus status, java.util.Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        this.fieldErrors = java.util.Map.copyOf(fieldErrors);
    }
}
