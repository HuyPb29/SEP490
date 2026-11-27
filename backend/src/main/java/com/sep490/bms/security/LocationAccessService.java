package com.sep490.bms.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.LocationRepository;

import jakarta.servlet.http.HttpServletRequest;

import lombok.RequiredArgsConstructor;

/**
 * Xác định địa điểm mà Owner hoặc Staff được phép thao tác.
 */
@Service
@RequiredArgsConstructor
public class LocationAccessService {
    private final LocationRepository locations;
    private final HttpServletRequest request;

    public Location selectedLocation(UserPrincipal user) {
        return selectedLocation(user, false);
    }

    /** Caller must hold a transaction; lock the venue before payments/booking targets. */
    public Location selectedLocationForUpdate(UserPrincipal user) {
        return selectedLocation(user, true);
    }

    private Location selectedLocation(UserPrincipal user, boolean forUpdate) {
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
        Location location = (forUpdate ? locations.findByIdForUpdate(id) : locations.findById(id))
                .orElseThrow(() -> new AppException("Không tìm thấy địa điểm", HttpStatus.NOT_FOUND));
        if (user.getRole() == Role.OWNER && !user.getId().equals(location.getOwnerId())) {
            throw new AppException("Địa điểm không thuộc Owner", HttpStatus.FORBIDDEN);
        }
        return location;
    }
}
