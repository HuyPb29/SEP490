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
        return store(file, folder, extension);
    }

    /** Giấy tờ xác minh: kiểm tra dung lượng, MIME và chữ ký tệp trước khi ghi bất kỳ tệp nào. */
    public void validateRegistrationDocument(MultipartFile file, String label) {
        if (file == null || file.isEmpty()) throw new AppException("Vui lòng đính kèm " + label);
        if (file.getSize() > MAX_BYTES) throw new AppException(label + " tối đa 5 MB");
        String type = file.getContentType();
        if (!EXTENSIONS.containsKey(type == null ? "" : type) && !"application/pdf".equals(type)) {
            throw new AppException(label + " chỉ nhận JPG, PNG hoặc PDF");
        }
        try (InputStream in = file.getInputStream()) {
            byte[] header = in.readNBytes(8);
            byte[] expected = switch (type) {
                case "image/jpeg" -> new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff};
                case "image/png" -> new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
                default -> new byte[] {0x25, 0x50, 0x44, 0x46, 0x2d};
            };
            if (header.length < expected.length || !java.util.Arrays.equals(expected, java.util.Arrays.copyOf(header, expected.length))) {
                throw new AppException(label + " không đúng nội dung JPG, PNG hoặc PDF");
            }
        } catch (IOException ex) {
            throw new AppException("Không đọc được " + label);
        }
    }

    public String storeRegistrationDocument(MultipartFile file, String folder, String label) {
        validateRegistrationDocument(file, label);
        String extension = "application/pdf".equals(file.getContentType()) ? ".pdf" : EXTENSIONS.get(file.getContentType());
        return store(file, folder, extension);
    }

    private String store(MultipartFile file, String folder, String extension) {
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

    /** Dọn file chưa được ghi nhận khi giao dịch tạo khiếu nại rollback. */
    public void discardImage(String relativePath) {
        try {
            Files.deleteIfExists(resolve(relativePath));
        } catch (IOException ex) {
            throw new AppException("Không thể dọn ảnh chưa được lưu", HttpStatus.INTERNAL_SERVER_ERROR);
        }
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
