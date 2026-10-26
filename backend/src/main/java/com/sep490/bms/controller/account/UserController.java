package com.sep490.bms.controller.account;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F1 – Quản lý tài khoản
 * Owner: Huy
 * UC: UC03 – Quản lý hồ sơ cá nhân
 */
@RestController
public class UserController {

    /**
     * UC03 – Quản lý hồ sơ cá nhân
     * Feature: F1 – Quản lý tài khoản
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/users/me")
    public ResponseEntity<Void> getUsersMe() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC03 – Quản lý hồ sơ cá nhân
     * Feature: F1 – Quản lý tài khoản
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/users/me")
    public ResponseEntity<Void> patchUsersMe() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
