package com.sep490.bms.controller.feedback;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Feature: F8 – Đánh giá và khiếu nại
 * Owner: Hoàng
 * UC: UC33 – Gửi và xử lý khiếu nại
 */
@RestController
public class ComplaintController {

    /**
     * UC33 – Gửi và xử lý khiếu nại
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/complaints")
    public ResponseEntity<Void> postComplaints() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC33 – Gửi và xử lý khiếu nại
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/me/complaints")
    public ResponseEntity<Void> getMeComplaints() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC33 – Gửi và xử lý khiếu nại
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/complaints/{id}")
    public ResponseEntity<Void> getComplaintsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC33 – Gửi và xử lý khiếu nại
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/complaints")
    public ResponseEntity<Void> getStaffComplaints() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC33 – Gửi và xử lý khiếu nại
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/staff/complaints/{id}")
    public ResponseEntity<Void> getStaffComplaintsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC33 – Gửi và xử lý khiếu nại
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/staff/complaints/{id}/forward")
    public ResponseEntity<Void> postStaffComplaintsByIdForward(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC33 – Gửi và xử lý khiếu nại
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/complaints")
    public ResponseEntity<Void> getOwnerComplaints() {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC33 – Gửi và xử lý khiếu nại
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @GetMapping("/api/owner/complaints/{id}")
    public ResponseEntity<Void> getOwnerComplaintsById(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC33 – Gửi và xử lý khiếu nại
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/complaints/{id}/resolve")
    public ResponseEntity<Void> postOwnerComplaintsByIdResolve(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * UC33 – Gửi và xử lý khiếu nại
     * Feature: F8 – Đánh giá và khiếu nại
     * Owner: Hoàng
     * Status: NOT_IMPLEMENTED
     */
    @PostMapping("/api/owner/complaints/{id}/reject")
    public ResponseEntity<Void> postOwnerComplaintsByIdReject(@PathVariable("id") String id) {
        // TODO: implement
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
