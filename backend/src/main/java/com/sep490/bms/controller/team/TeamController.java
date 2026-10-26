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
public class TeamController {

    /**
     * UC27 – Quản lý đội
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/teams")
    public ResponseEntity<Void> getTeams() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC27 – Quản lý đội
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/teams/{id}")
    public ResponseEntity<Void> getTeamsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC27 – Quản lý đội
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/teams")
    public ResponseEntity<Void> postTeams() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC27 – Quản lý đội
     * Feature: F7 – Đội và kèo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/me/teams")
    public ResponseEntity<Void> getMeTeams() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
