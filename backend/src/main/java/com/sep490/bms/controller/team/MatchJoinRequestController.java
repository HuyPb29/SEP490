package com.sep490.bms.controller.team;

import java.util.List;

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
import com.sep490.bms.dto.team.JoinRequestCreateRequest;
import com.sep490.bms.dto.team.JoinRequestResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.team.MatchService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Feature: F7 – Đội và kèo
 * Owner: Hoàng
 * UC: UC28 – Quản lý kèo (chủ kèo); UC30 – Tham gia kèo
 */
@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLAYER')")
public class MatchJoinRequestController {

    private final MatchService matchService;

    @GetMapping("/api/matches/{id}/join-requests")
    public ResponseEntity<ApiResponse<List<JoinRequestResponse>>> getMatchesByIdJoinRequests(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(matchService.getJoinRequests(currentUser.getId(), id, status)));
    }

    @PostMapping("/api/match-join-requests/{id}/approve")
    public ResponseEntity<ApiResponse<JoinRequestResponse>> postMatchJoinRequestsByIdApprove(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success("Đã duyệt người chơi vào kèo",
                matchService.approveJoinRequest(currentUser.getId(), id)));
    }

    @PostMapping("/api/match-join-requests/{id}/reject")
    public ResponseEntity<ApiResponse<JoinRequestResponse>> postMatchJoinRequestsByIdReject(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success("Đã từ chối yêu cầu tham gia kèo",
                matchService.rejectJoinRequest(currentUser.getId(), id)));
    }

    @PostMapping("/api/matches/{id}/join-requests")
    public ResponseEntity<ApiResponse<JoinRequestResponse>> postMatchesByIdJoinRequests(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody JoinRequestCreateRequest request) {
        JoinRequestResponse created = matchService.createJoinRequest(currentUser.getId(), id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Đã gửi yêu cầu tham gia kèo", created));
    }

    @PostMapping("/api/match-join-requests/{id}/cancel")
    public ResponseEntity<ApiResponse<JoinRequestResponse>> postMatchJoinRequestsByIdCancel(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success("Đã hủy yêu cầu tham gia kèo",
                matchService.cancelJoinRequest(currentUser.getId(), id)));
    }
}
