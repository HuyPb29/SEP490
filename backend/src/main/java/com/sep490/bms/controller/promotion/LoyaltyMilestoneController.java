package com.sep490.bms.controller.promotion;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F6 – Ưu đãi
 * Owner: Huy
 * UC: UC26 – Quản lý ưu đãi tích lũy
 */
@RestController
public class LoyaltyMilestoneController {

    /**
     * UC26 – Quản lý ưu đãi tích lũy
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/loyalty-milestones")
    public ResponseEntity<Void> getOwnerLoyaltyMilestones() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC26 – Quản lý ưu đãi tích lũy
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/loyalty-milestones")
    public ResponseEntity<Void> postOwnerLoyaltyMilestones() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC26 – Quản lý ưu đãi tích lũy
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PatchMapping("/api/owner/loyalty-milestones/{id}")
    public ResponseEntity<Void> patchOwnerLoyaltyMilestonesById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
