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
import com.sep490.bms.service.team.TeamService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Feature: F7 – Đội và kèo
 * Owner: Hoàng
 * UC: UC27 – Quản lý đội
 */
@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLAYER')")
public class TeamJoinRequestController {

    private final TeamService teamService;

    @PostMapping("/api/teams/{id}/join-requests")
    public ResponseEntity<ApiResponse<JoinRequestResponse>> postTeamsByIdJoinRequests(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody JoinRequestCreateRequest request) {
        JoinRequestResponse created = teamService.createJoinRequest(currentUser.getId(), id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Đã gửi yêu cầu vào đội", created));
    }

    @GetMapping("/api/teams/{id}/join-requests")
    public ResponseEntity<ApiResponse<List<JoinRequestResponse>>> getTeamsByIdJoinRequests(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(teamService.getJoinRequests(currentUser.getId(), id, status)));
    }

    @PostMapping("/api/team-join-requests/{id}/approve")
    public ResponseEntity<ApiResponse<JoinRequestResponse>> postTeamJoinRequestsByIdApprove(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success("Đã duyệt yêu cầu vào đội",
                teamService.approveJoinRequest(currentUser.getId(), id)));
    }

    @PostMapping("/api/team-join-requests/{id}/reject")
    public ResponseEntity<ApiResponse<JoinRequestResponse>> postTeamJoinRequestsByIdReject(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success("Đã từ chối yêu cầu vào đội",
                teamService.rejectJoinRequest(currentUser.getId(), id)));
    }

    @PostMapping("/api/team-join-requests/{id}/cancel")
    public ResponseEntity<ApiResponse<JoinRequestResponse>> postTeamJoinRequestsByIdCancel(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success("Đã hủy yêu cầu vào đội",
                teamService.cancelJoinRequest(currentUser.getId(), id)));
    }
}
