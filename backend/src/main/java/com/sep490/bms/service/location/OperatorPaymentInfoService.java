package com.sep490.bms.service.location;

import java.time.LocalDateTime;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.sep490.bms.dto.location.OperatorPaymentInfoDto;
import com.sep490.bms.dto.location.UpdateOperatorPaymentInfoRequest;
import com.sep490.bms.entity.location.OperatorPaymentInfo;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.OperatorPaymentInfoRepository;
import com.sep490.bms.security.UserPrincipal;
import com.sep490.bms.service.integration.FileStorageService;

import lombok.RequiredArgsConstructor;

/**
 * Feature: F2 - Quản lý địa điểm
 * Owner: Minh Anh (Leader code thay theo D168, D169)
 * UC05 #5, UC06 #8 - Thông tin nhận chuyển khoản và mã QR của bên vận hành (FR127, DR28).
 *
 * Có sẵn một dòng mặc định khi cài hệ thống; chưa có ảnh QR tải lên thì trả ảnh mặc định đóng gói trong backend,
 * nên form đăng ký luôn hiện được QR (D169). Ai cũng xem được vì Guest phải chuyển khoản trước khi gửi đơn.
 */
@Service
@RequiredArgsConstructor
public class OperatorPaymentInfoService {

    static final String DEFAULT_QR = "operator/default-qr.png";

    private final OperatorPaymentInfoRepository repository;
    private final FileStorageService files;

    @Transactional(readOnly = true)
    public OperatorPaymentInfoDto get() {
        return OperatorPaymentInfoDto.fromEntity(requireRow());
    }

    @Transactional(readOnly = true)
    public Resource loadQr() {
        String path = requireRow().getQrImagePath();
        if (path == null || path.isBlank()) {
            return new ClassPathResource(DEFAULT_QR);
        }
        return files.load(path);
    }

    /** UC06 #8 - Admin sửa ngân hàng, số tài khoản, tên chủ tài khoản. */
    @Transactional
    public OperatorPaymentInfoDto update(UserPrincipal admin, UpdateOperatorPaymentInfoRequest request) {
        OperatorPaymentInfo row = requireRow();
        row.setBankName(requireText(request.getBankName(), "Tên ngân hàng", 100));
        row.setBankAccountNo(requireText(request.getBankAccountNo(), "Số tài khoản", 30));
        row.setBankAccountHolder(requireText(request.getBankAccountHolder(), "Tên chủ tài khoản", 100));
        touch(row, admin);
        return OperatorPaymentInfoDto.fromEntity(repository.save(row));
    }

    /** UC06 #8 - Admin thay ảnh QR (JPG/PNG, tối đa 5 MB do FileStorageService kiểm tra, DR28). */
    @Transactional
    public OperatorPaymentInfoDto uploadQr(UserPrincipal admin, MultipartFile image) {
        OperatorPaymentInfo row = requireRow();
        row.setQrImagePath(files.storeImage(image, "operator-qr"));
        touch(row, admin);
        return OperatorPaymentInfoDto.fromEntity(repository.save(row));
    }

    private OperatorPaymentInfo requireRow() {
        // Dòng id = 1 tạo khi cài hệ thống (BMS_database.sql, migration 20261119). Thiếu là lỗi cài đặt.
        return repository.findById(OperatorPaymentInfo.SINGLE_ROW_ID)
                .orElseThrow(() -> new AppException("Chưa có thông tin nhận chuyển khoản của bên vận hành",
                        HttpStatus.INTERNAL_SERVER_ERROR));
    }

    private void touch(OperatorPaymentInfo row, UserPrincipal admin) {
        row.setUpdatedBy(admin == null ? null : admin.getId());
        row.setUpdatedAt(LocalDateTime.now());
    }

    private String requireText(String value, String fieldLabel, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new AppException(fieldLabel + " không được để trống");
        }
        if (trimmed.length() > maxLength) {
            throw new AppException(fieldLabel + " tối đa " + maxLength + " ký tự");
        }
        return trimmed;
    }
}
