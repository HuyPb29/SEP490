package com.sep490.bms.controller.team;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F7 – Đội và kèo
 * Owner: Hoàng
 * UC: UC28 – Quản lý kèo (chủ kèo); UC29 – Xem thông tin kèo
 */
@RestController
public class MatchController {

    /**
     * UC28 – Quản lý kèo (chủ kèo)
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/matches")
    public ResponseEntity<Void> postMatches() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC28 – Quản lý kèo (chủ kèo)
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/matches/{id}")
    public ResponseEntity<Void> patchMatchesById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC28 – Quản lý kèo (chủ kèo)
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/matches/{id}/close")
    public ResponseEntity<Void> postMatchesByIdClose(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC28 – Quản lý kèo (chủ kèo)
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/matches/{id}/cancel")
    public ResponseEntity<Void> postMatchesByIdCancel(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC29 – Xem thông tin kèo
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/matches")
    public ResponseEntity<Void> getMatches() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC29 – Xem thông tin kèo
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/matches/{id}")
    public ResponseEntity<Void> getMatchesById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
