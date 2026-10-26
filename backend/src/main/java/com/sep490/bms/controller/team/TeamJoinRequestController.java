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
 * UC: UC27 – Quản lý đội
 */
@RestController
public class TeamJoinRequestController {

    /**
     * UC27 – Quản lý đội
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/teams/{id}/join-requests")
    public ResponseEntity<Void> postTeamsByIdJoinRequests(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC27 – Quản lý đội
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/teams/{id}/join-requests")
    public ResponseEntity<Void> getTeamsByIdJoinRequests(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC27 – Quản lý đội
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/team-join-requests/{id}/approve")
    public ResponseEntity<Void> postTeamJoinRequestsByIdApprove(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC27 – Quản lý đội
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/team-join-requests/{id}/reject")
    public ResponseEntity<Void> postTeamJoinRequestsByIdReject(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC27 – Quản lý đội
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/team-join-requests/{id}/cancel")
    public ResponseEntity<Void> postTeamJoinRequestsByIdCancel(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
