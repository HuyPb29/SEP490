package com.sep490.bms.controller.account;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.UserDto;
import com.sep490.bms.dto.request.CreateStaffRequest;
import com.sep490.bms.dto.request.StaffPasswordRequest;
import com.sep490.bms.dto.request.UpdateStatusRequest;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.StaffService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/owner/staff-members")
@RequiredArgsConstructor
@PreAuthorize("hasRole('OWNER')")
public class StaffController {

    private final StaffService staffService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<UserDto>>> getStaff(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        List<UserDto> staffList = staffService.getStaffList(currentUser, status, search);
        return ResponseEntity.ok(ApiResponse.success(staffList));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<UserDto>> createStaff(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody CreateStaffRequest request) {
        UserDto staff = staffService.createStaff(currentUser, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo tài khoản nhân viên thành công (MSG12)", staff));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<UserDto>> updateStaffStatus(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateStatusRequest request) {
        UserDto updated = staffService.updateStaffStatus(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật trạng thái nhân viên thành công (MSG03)", updated));
    }

    @PostMapping("/{id}/password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody StaffPasswordRequest request) {
        staffService.resetStaffPassword(currentUser, id, request);
        return ResponseEntity.ok(ApiResponse.success("Cấp lại mật khẩu nhân viên thành công", null));
    }
}
