package com.sep490.bms.controller.team;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.common.PageResponse;
import com.sep490.bms.dto.team.CreateMatchRequest;
import com.sep490.bms.dto.team.MatchResponse;
import com.sep490.bms.dto.team.UpdateMatchRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.team.MatchService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Feature: F7 – Đội và kèo
 * Owner: Hoàng
 * UC: UC28 – Quản lý kèo (chủ kèo); UC29 – Xem thông tin kèo
 */
@RestController
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    @PostMapping("/api/matches")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<MatchResponse>> postMatches(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody CreateMatchRequest request) {
        MatchResponse match = matchService.createMatch(currentUser.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Mở kèo thành công", match));
    }

    @PatchMapping("/api/matches/{id}")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<MatchResponse>> patchMatchesById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateMatchRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật kèo thành công",
                matchService.updateMatch(currentUser.getId(), id, request)));
    }

    @PostMapping("/api/matches/{id}/close")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<MatchResponse>> postMatchesByIdClose(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success("Đã đóng kèo", matchService.closeMatch(currentUser.getId(), id)));
    }

    @PostMapping("/api/matches/{id}/cancel")
    @PreAuthorize("hasRole('PLAYER')")
    public ResponseEntity<ApiResponse<MatchResponse>> postMatchesByIdCancel(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success("Đã hủy kèo", matchService.cancelMatch(currentUser.getId(), id)));
    }

    @GetMapping("/api/matches")
    public ResponseEntity<ApiResponse<PageResponse<MatchResponse>>> getMatches(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long locationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate playDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                matchService.getMatches(currentUser == null ? null : currentUser.getId(), status, locationId, playDate, page, size)));
    }

    @GetMapping("/api/matches/{id}")
    public ResponseEntity<ApiResponse<MatchResponse>> getMatchesById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(matchService.getMatch(currentUser == null ? null : currentUser.getId(), id)));
    }
}
