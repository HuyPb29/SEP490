package com.sep490.bms.controller.account;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F1 – Quản lý tài khoản
 * Owner: Huy
 * UC: UC04 – Quản lý tài khoản và phân quyền
 */
@RestController
public class AccountController {

    /**
     * UC04 – Quản lý tài khoản và phân quyền
     * Feature: F1 – Quản lý tài khoản
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/admin/accounts")
    public ResponseEntity<Void> getAdminAccounts() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC04 – Quản lý tài khoản và phân quyền
     * Feature: F1 – Quản lý tài khoản
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/admin/accounts/{id}")
    public ResponseEntity<Void> patchAdminAccountsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
