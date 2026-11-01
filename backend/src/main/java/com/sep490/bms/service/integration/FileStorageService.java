package com.sep490.bms.service.integration;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.sep490.bms.exception.AppException;

/**
 * Lưu ảnh trên ổ đĩa của máy chạy backend; DB chỉ lưu đường dẫn tương đối (A03).
 * Dùng cho ảnh chứng từ thanh toán (payment_proof.image_path, FR54, FR55) và ảnh QR của địa điểm (location.qr_image_path).
 * Thư mục không mở công khai: ảnh chỉ trả qua API đã kiểm tra quyền (NFR07), service gọi {@link #load} sau khi kiểm tra.
 */
@Service
public class FileStorageService {

    /** Đề xuất, chưa duyệt: giới hạn dung lượng và định dạng ảnh (chống tải file rác, NFR07). */
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png");

    private final Path root;

    /** Mặc định lưu ngoài thư mục repo (không bị commit nhầm lên git). */
    public FileStorageService(@Value("${app.upload.dir:${user.home}/bms-uploads}") String uploadDir) {
        this.root = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    /**
     * Lưu ảnh vào {@code folder}/năm/tháng/ với tên ngẫu nhiên, trả về đường dẫn tương đối để lưu vào DB,
     * ví dụ "payment-proofs/2026/10/3f2a….jpg". Không dùng tên file của người gửi.
     */
    public String storeImage(MultipartFile file, String folder) {
        if (file == null || file.isEmpty()) {
            throw new AppException("Vui lòng đính kèm ảnh");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new AppException("Ảnh tối đa 5 MB");
        }
        String extension = EXTENSIONS.get(file.getContentType());
        if (extension == null) {
            throw new AppException("Chỉ nhận ảnh JPG hoặc PNG");
        }
        LocalDate today = LocalDate.now();
        String relative = String.format("%s/%d/%02d/%s%s",
                folder, today.getYear(), today.getMonthValue(), UUID.randomUUID(), extension);
        Path target = resolve(relative);
        try (InputStream in = file.getInputStream()) {
            Files.createDirectories(target.getParent());
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new AppException("Không lưu được ảnh, vui lòng thử lại", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return relative;
    }

    /** Đọc lại ảnh đã lưu. Gọi sau khi đã kiểm tra người xem có quyền với ảnh này. */
    public Resource load(String relativePath) {
        Path path = resolve(relativePath);
        if (!Files.isRegularFile(path)) {
            throw new AppException("Không tìm thấy ảnh", HttpStatus.NOT_FOUND);
        }
        return new PathResource(path);
    }

    /** Chặn đường dẫn kiểu "../../" thoát ra ngoài thư mục lưu ảnh. */
    private Path resolve(String relativePath) {
        Path path = root.resolve(relativePath).normalize();
        if (!path.startsWith(root)) {
            throw new AppException("Đường dẫn ảnh không hợp lệ");
        }
        return path;
    }
}
