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
import com.sep490.bms.dto.team.CreateTeamRequest;
import com.sep490.bms.dto.team.TeamResponse;
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
public class TeamController {

    private final TeamService teamService;

    @GetMapping("/api/teams")
    public ResponseEntity<ApiResponse<List<TeamResponse>>> getTeams(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(ApiResponse.success(teamService.getTeams(currentUser.getId(), search)));
    }

    @GetMapping("/api/teams/{id}")
    public ResponseEntity<ApiResponse<TeamResponse>> getTeamsById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(teamService.getTeam(currentUser.getId(), id)));
    }

    @PostMapping("/api/teams")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<TeamResponse>> postTeams(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody CreateTeamRequest request) {
        TeamResponse team = teamService.createTeam(currentUser.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Tạo đội thành công", team));
    }

    @GetMapping("/api/me/teams")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<List<TeamResponse>>> getMeTeams(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(ApiResponse.success(teamService.getMyTeams(currentUser.getId())));
    }
}
