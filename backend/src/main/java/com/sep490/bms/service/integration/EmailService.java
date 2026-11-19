package com.sep490.bms.service.integration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import lombok.extern.slf4j.Slf4j;
import com.sep490.bms.exception.AppException;
import org.springframework.http.HttpStatus;

/**
 * Gửi email qua SMTP: mã OTP xác minh đăng ký, khôi phục mật khẩu, kết quả duyệt đăng ký sử dụng dịch vụ (MSG116, MSG117).
 */
@Service
@Slf4j
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    public void sendVerificationOtp(String toEmail, String otpCode) {
        String subject = "Mã xác thực đăng ký tài khoản BMS";
        String content = "Xin chào,\n\n"
                + "Cảm ơn bạn đã đăng ký tài khoản tại Hệ thống quản lý sân cầu lông BMS.\n"
                + "Mã xác thực (OTP) của bạn là: " + otpCode + "\n\n"
                + "Mã này có hiệu lực trong vòng 10 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.\n\n"
                + "Trân trọng,\n"
                + "Đội ngũ quản trị BMS";
        sendEmail(toEmail, subject, content);
    }

    public void sendPasswordResetOtp(String toEmail, String otpCode) {
        String subject = "Mã xác nhận đặt lại mật khẩu BMS";
        String content = "Xin chào,\n\n"
                + "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản BMS của bạn.\n"
                + "Mã xác nhận (OTP) của bạn là: " + otpCode + "\n\n"
                + "Mã này có hiệu lực trong vòng 10 phút. Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email.\n\n"
                + "Trân trọng,\n"
                + "Đội ngũ quản trị BMS";
        sendEmail(toEmail, subject, content);
    }

    /**
     * MSG116 (FR11): báo chủ sân yêu cầu đăng ký sử dụng dịch vụ đã được duyệt.
     * {@code username}, {@code password} để null khi Owner đã có tài khoản đăng ký thêm địa điểm.
     */
    public void sendServiceRegistrationApproved(String toEmail, String locationName, int courtCount,
            String rentalAmount, String startDate, String endDate, String username, String password) {
        String subject = "Yêu cầu đăng ký sử dụng dịch vụ BMS đã được duyệt";
        StringBuilder content = new StringBuilder("Xin chào,\n\n")
                .append("Yêu cầu đăng ký địa điểm ").append(locationName).append(" đã được duyệt.\n")
                .append("Số sân con: ").append(courtCount).append(".\n")
                .append("Số tiền thuê: ").append(rentalAmount).append(" đồng.\n")
                .append("Thời hạn sử dụng dịch vụ: từ ").append(startDate).append(" đến ").append(endDate).append(".\n");
        if (username != null && password != null) {
            content.append("Tên đăng nhập: ").append(username).append(".\n")
                    .append("Mật khẩu: ").append(password).append(".\n\n")
                    .append("Vui lòng giữ bí mật tên đăng nhập và mật khẩu. "
                            + "Anh/chị có thể đổi mật khẩu sau khi đăng nhập.\n");
        } else {
            content.append("\nĐịa điểm đã được gắn vào tài khoản Owner hiện có của anh/chị.\n");
        }
        content.append("\nTrân trọng,\nĐội ngũ quản trị BMS");
        sendEmail(toEmail, subject, content.toString(), "Không gửi được email kết quả cho chủ sân. Vui lòng thử lại sau");
    }

    /** MSG117 (FR11): báo chủ sân yêu cầu bị từ chối, kèm lý do; tiền thuê do bên vận hành liên hệ hoàn ngoài hệ thống. */
    public void sendServiceRegistrationRejected(String toEmail, String locationName, String reason) {
        String subject = "Yêu cầu đăng ký sử dụng dịch vụ BMS chưa được duyệt";
        String content = "Xin chào,\n\n"
                + "Yêu cầu đăng ký địa điểm " + locationName + " chưa được duyệt.\n"
                + "Lý do: " + reason + "\n"
                + "Bên vận hành sẽ liên hệ với anh/chị để hoàn lại tiền thuê đã chuyển.\n\n"
                + "Trân trọng,\n"
                + "Đội ngũ quản trị BMS";
        sendEmail(toEmail, subject, content, "Không gửi được email kết quả cho chủ sân. Vui lòng thử lại sau");
    }

    private void sendEmail(String toEmail, String subject, String content) {
        sendEmail(toEmail, subject, content, "Không thể gửi email xác thực. Vui lòng thử lại sau");
    }

    private void sendEmail(String toEmail, String subject, String content, String failureMessage) {
        if (!mailEnabled || mailSender == null || !StringUtils.hasText(fromEmail)) {
            throw new AppException("Dịch vụ gửi email chưa sẵn sàng. Vui lòng thử lại sau", HttpStatus.SERVICE_UNAVAILABLE);
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(content);
            mailSender.send(message);
        } catch (Exception ex) {
            // Do not log the message body or provider exception, which may include the OTP or an Owner password.
            log.error("SMTP delivery failed ({})", ex.getClass().getSimpleName());
            throw new AppException(failureMessage, HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
}
