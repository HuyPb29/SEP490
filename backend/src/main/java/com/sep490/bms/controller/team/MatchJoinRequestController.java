package com.sep490.bms.controller.team;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F7 – Đội và kèo
 * Owner: Hoàng
 * UC: UC28 – Quản lý kèo (chủ kèo); UC30 – Tham gia kèo
 */
@RestController
public class MatchJoinRequestController {

    /**
     * UC28 – Quản lý kèo (chủ kèo)
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/matches/{id}/join-requests")
    public ResponseEntity<Void> getMatchesByIdJoinRequests(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC28 – Quản lý kèo (chủ kèo)
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/match-join-requests/{id}/approve")
    public ResponseEntity<Void> postMatchJoinRequestsByIdApprove(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC28 – Quản lý kèo (chủ kèo)
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/match-join-requests/{id}/reject")
    public ResponseEntity<Void> postMatchJoinRequestsByIdReject(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC30 – Tham gia kèo
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/matches/{id}/join-requests")
    public ResponseEntity<Void> postMatchesByIdJoinRequests(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC30 – Tham gia kèo
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/match-join-requests/{id}/cancel")
    public ResponseEntity<Void> postMatchJoinRequestsByIdCancel(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
