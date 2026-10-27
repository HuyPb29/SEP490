package com.sep490.bms.controller.operation;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F9 – Vận hành và báo cáo
 * Owner: Hoàng
 * UC: UC35 – Xem báo cáo vận hành và doanh thu
 */
@RestController
public class ReportController {

    /**
     * UC35 – Xem báo cáo vận hành và doanh thu
     * Feature: F9 – Vận hành và báo cáo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/booking-reports")
    public ResponseEntity<Void> getOwnerBookingReports() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC35 – Xem báo cáo vận hành và doanh thu
     * Feature: F9 – Vận hành và báo cáo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/revenue-reports")
    public ResponseEntity<Void> getOwnerRevenueReports() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC35 – Xem báo cáo vận hành và doanh thu
     * Feature: F9 – Vận hành và báo cáo
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/occupancy-reports")
    public ResponseEntity<Void> getOwnerOccupancyReports() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @GetMapping("/api/owner/cancellation-reports")
    public ResponseEntity<Void> cancellationReport() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @GetMapping("/api/owner/reschedule-reports")
    public ResponseEntity<Void> rescheduleReport() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    /** API contract scaffold; business service is not implemented yet. */
    @GetMapping("/api/owner/voucher-reports")
    public ResponseEntity<Void> voucherReport() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
