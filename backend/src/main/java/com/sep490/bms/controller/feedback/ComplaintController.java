package com.sep490.bms.controller.feedback;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.feedback.ComplaintResponse;
import com.sep490.bms.dto.feedback.CreateComplaintRequest;
import com.sep490.bms.dto.feedback.ForwardComplaintRequest;
import com.sep490.bms.dto.feedback.RejectComplaintRequest;
import com.sep490.bms.dto.feedback.ResolveComplaintRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.feedback.ComplaintService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Feature: F8 – Đánh giá và khiếu nại
 * Owner: Hoàng
 * UC: UC33 – Gửi và xử lý khiếu nại
 */
@RestController
@RequiredArgsConstructor
public class ComplaintController {

    private final ComplaintService complaintService;

    /** Player gửi khiếu nại, gồm cả xác nhận thanh toán trễ (BR49). */
    @PostMapping("/api/complaints")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<ComplaintResponse>> postComplaints(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody CreateComplaintRequest request) {
        ComplaintResponse complaint = complaintService.createComplaint(currentUser, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Đã gửi khiếu nại", complaint));
    }

    @GetMapping("/api/me/complaints")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<PageResponse<ComplaintResponse>>> getMeComplaints(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(complaintService.listMine(currentUser.getId(), page, size)));
    }

    @GetMapping("/api/complaints/{id}")
    public ResponseEntity<ApiResponse<ComplaintResponse>> getComplaintsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(complaintService.getComplaint(currentUser, id)));
    }

    @GetMapping("/api/staff/complaints")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse<PageResponse<ComplaintResponse>>> getStaffComplaints(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(complaintService.listForStaff(currentUser, status, page, size)));
    }

    @GetMapping("/api/staff/complaints/{id}")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse<ComplaintResponse>> getStaffComplaintsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(complaintService.getComplaint(currentUser, id)));
    }

    /** Staff ghi chú và chuyển khiếu nại lên Owner. */
    @PostMapping("/api/staff/complaints/{id}/forward")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse<ComplaintResponse>> postStaffComplaintsByIdForward(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody ForwardComplaintRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã chuyển khiếu nại cho chủ sân",
                complaintService.forward(currentUser, id, request)));
    }

    @GetMapping("/api/owner/complaints")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<PageResponse<ComplaintResponse>>> getOwnerComplaints(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                complaintService.listForOwner(currentUser.getId(), status, page, size)));
    }

    @GetMapping("/api/owner/complaints/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<ComplaintResponse>> getOwnerComplaintsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(complaintService.getComplaint(currentUser, id)));
    }

    @PostMapping("/api/owner/complaints/{id}/resolve")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<ComplaintResponse>> postOwnerComplaintsByIdResolve(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody ResolveComplaintRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã xử lý khiếu nại",
                complaintService.resolve(currentUser.getId(), id, request)));
    }

    @PostMapping("/api/owner/complaints/{id}/reject")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<ComplaintResponse>> postOwnerComplaintsByIdReject(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody RejectComplaintRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã từ chối khiếu nại",
                complaintService.reject(currentUser.getId(), id, request)));
    }
}
