package com.sep490.bms.controller;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.sep490.bms.common.ApiResponse;
import com.sep490.bms.dto.UserDto;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.StaffService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
public class StaffController {

    private final StaffService staffService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<UserDto>>> getStaff(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) Long locationId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        List<UserDto> staffList = staffService.getStaffList(currentUser, locationId, status, search);
        return ResponseEntity.ok(ApiResponse.success(staffList));
    }
}
