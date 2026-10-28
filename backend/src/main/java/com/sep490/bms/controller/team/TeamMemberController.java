package com.sep490.bms.controller.team;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.team.TeamMemberResponse;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.team.TeamService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F7 – Đội và kèo
 * Owner: Hoàng
 * UC: UC27 – Quản lý đội
 */
@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLAYER')")
public class TeamMemberController {

    private final TeamService teamService;

    @GetMapping("/api/teams/{id}/members")
    public ResponseEntity<ApiResponse<List<TeamMemberResponse>>> getTeamsByIdMembers(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(teamService.getMembers(currentUser.getId(), id)));
    }

    @PostMapping("/api/teams/{id}/leave")
    public ResponseEntity<ApiResponse<Void>> postTeamsByIdLeave(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        teamService.leaveTeam(currentUser.getId(), id);
        return ResponseEntity.ok(ApiResponse.success("Bạn đã rời đội"));
    }

    @DeleteMapping("/api/team-members/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteTeamMembersById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        teamService.removeMember(currentUser.getId(), id);
        return ResponseEntity.ok(ApiResponse.success("Đã xóa thành viên khỏi đội"));
    }
}
