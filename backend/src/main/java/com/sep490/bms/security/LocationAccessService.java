package com.sep490.bms.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.sep490.bms.entity.*;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.LocationRepository;

import jakarta.servlet.http.HttpServletRequest;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LocationAccessService {
    private final LocationRepository locations;
    private final HttpServletRequest request;

    public Location selectedLocation(UserPrincipal user) {
        String header = request.getHeader("X-Location-Id");
        Long id = null;
        if (header != null) {
            try { id = Long.valueOf(header); }
            catch (NumberFormatException e) { throw new AppException("X-Location-Id không hợp lệ"); }
            if (id <= 0) throw new AppException("X-Location-Id không hợp lệ");
        }
        if (user.getRole() == Role.STAFF) {
            if (user.getLocationId() == null || (id != null && !id.equals(user.getLocationId()))) {
                throw new AppException("Không có quyền truy cập địa điểm", HttpStatus.FORBIDDEN);
            }
            id = user.getLocationId();
        } else if (user.getRole() != Role.OWNER) {
            throw new AppException("Không có quyền truy cập địa điểm", HttpStatus.FORBIDDEN);
        }
        if (id == null) throw new AppException("Cần gửi header X-Location-Id để chọn địa điểm");
        Location location = locations.findById(id)
                .orElseThrow(() -> new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));
        if (user.getRole() == Role.OWNER && !user.getId().equals(location.getOwnerId())) {
            throw new AppException("Địa điểm không thuộc Owner", HttpStatus.FORBIDDEN);
        }
        return location;
    }
}
