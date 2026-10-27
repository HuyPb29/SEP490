package com.sep490.bms.controller.account;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F1 – Quản lý tài khoản
 * Owner: Huy
 * UC: UC04 – Quản lý tài khoản và phân quyền
 */
@RestController
public class StaffMemberController {

    /**
     * UC04 – Quản lý tài khoản và phân quyền
     * Feature: F1 – Quản lý tài khoản
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/staff-members")
    public ResponseEntity<Void> getOwnerStaffMembers() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC04 – Quản lý tài khoản và phân quyền
     * Feature: F1 – Quản lý tài khoản
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/staff-members")
    public ResponseEntity<Void> postOwnerStaffMembers() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC04 – Quản lý tài khoản và phân quyền
     * Feature: F1 – Quản lý tài khoản
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/owner/staff-members/{id}")
    public ResponseEntity<Void> patchOwnerStaffMembersById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
