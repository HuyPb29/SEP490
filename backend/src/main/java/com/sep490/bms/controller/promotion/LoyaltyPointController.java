package com.sep490.bms.controller.promotion;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F6 – Ưu đãi
 * Owner: Huy
 * UC: UC25 – Tích điểm và dùng điểm
 */
@RestController
public class LoyaltyPointController {

    /**
     * UC25 – Tích điểm và dùng điểm
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/me/loyalty-balances")
    public ResponseEntity<Void> getMeLoyaltyBalances() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC25 – Tích điểm và dùng điểm
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/me/loyalty-transactions")
    public ResponseEntity<Void> getMeLoyaltyTransactions() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }


    /**
     * UC25 – Tích điểm và dùng điểm
     * Feature: F6 – Ưu đãi
     * Owner: Huy
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/loyalty-adjustments")
    public ResponseEntity<Void> postOwnerLoyaltyAdjustments() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
