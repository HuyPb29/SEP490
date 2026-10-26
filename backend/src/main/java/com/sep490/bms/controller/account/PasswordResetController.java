package com.sep490.bms.controller.account;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F1 – Quản lý tài khoản
 * Owner: Huy
 * UC: UC02 – Đăng nhập và đăng xuất
 */
@RestController
public class PasswordResetController {

    /**
     * UC02 – Đăng nhập và đăng xuất
     * Feature: F1 – Quản lý tài khoản
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/password-reset-requests")
    public ResponseEntity<Void> postPasswordResetRequests() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC02 – Đăng nhập và đăng xuất
     * Feature: F1 – Quản lý tài khoản
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/password-resets")
    public ResponseEntity<Void> postPasswordResets() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
